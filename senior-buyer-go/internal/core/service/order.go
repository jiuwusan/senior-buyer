package service

import (
	"log"
	"sync"
	"time"

	"github.com/zhoukaidong/senior-buyer-go/internal/domain/model"
	"github.com/zhoukaidong/senior-buyer-go/internal/infra/config"
)

// Order manages multiple order tasks and polling mechanism
type Order struct {
	tasks         []*OrderTask
	polling       bool
	pollingMutex  sync.RWMutex
	interval      int
	loader        *config.Loader
	isWeidian     bool
	lastPollTime  int64
}

// NewOrder creates a new Order manager
func NewOrder(loader *config.Loader, isWeidian bool) *Order {
	order := &Order{
		tasks:     make([]*OrderTask, 0),
		interval:  100, // Default polling interval 100ms
		loader:    loader,
		isWeidian: isWeidian,
	}

	// Load initial configuration
	order.UpdateTasks()

	return order
}

// UpdateTasks reloads configuration and recreates tasks
func (o *Order) UpdateTasks() error {
	var configs []model.TaskConfig
	var err error

	if o.isWeidian {
		configs, err = o.loader.LoadWeidianConfig()
	} else {
		configs, err = o.loader.LoadYouzanConfig()
	}

	if err != nil {
		log.Printf("加载配置失败: %v", err)
		return err
	}

	// Print configs
	for i, item := range configs {
		log.Printf("配置文件 %d： %+v", i+1, item)
	}

	// Create tasks from configs
	o.tasks = make([]*OrderTask, 0, len(configs))
	for _, cfg := range configs {
		task := NewOrderTask(&cfg, o.isWeidian)
		o.tasks = append(o.tasks, task)
	}

	return nil
}

// QueryConfig returns all task configurations
func (o *Order) QueryConfig() []model.TaskConfig {
	configs := make([]model.TaskConfig, 0, len(o.tasks))
	for _, task := range o.tasks {
		configs = append(configs, *task.GetConfig())
	}
	return configs
}

// QueryCart queries shopping carts for all tasks
func (o *Order) QueryCart() ([][]*model.CartResult, error) {
	var wg sync.WaitGroup
	results := make([][]*model.CartResult, len(o.tasks))

	for i, task := range o.tasks {
		wg.Add(1)
		go func(idx int, t *OrderTask) {
			defer wg.Done()
			result, _ := t.QueryCart()
			results[idx] = result
		}(i, task)
	}

	wg.Wait()
	return results, nil
}

// CreateOrder creates orders for all tasks
func (o *Order) CreateOrder(combine bool) ([][][]model.OrderResult, error) {
	var wg sync.WaitGroup
	results := make([][][]model.OrderResult, len(o.tasks))

	for i, task := range o.tasks {
		wg.Add(1)
		go func(idx int, t *OrderTask) {
			defer wg.Done()
			result, _ := t.CreateOrder(combine)
			results[idx] = result
		}(i, task)
	}

	wg.Wait()
	return results, nil
}

// QueryPreOrder queries pre-order information for all tasks
func (o *Order) QueryPreOrder() ([][]*model.PreOrderInfo, error) {
	var wg sync.WaitGroup
	results := make([][][]*model.PreOrderInfo, len(o.tasks))

	for i, task := range o.tasks {
		wg.Add(1)
		go func(idx int, t *OrderTask) {
			defer wg.Done()
			result, _ := t.QueryPreOrder()
			results[idx] = result
		}(i, task)
	}

	wg.Wait()
	return results, nil
}

// PollingOrder starts or stops polling mode
func (o *Order) PollingOrder(polling bool, interval int) string {
	o.pollingMutex.Lock()

	isStarting := polling && !o.polling
	isStopping := !polling && o.polling

	o.interval = interval
	o.polling = polling

	o.pollingMutex.Unlock()

	if isStopping {
		log.Println("用户手动触发：停止轮询")
	}

	if isStarting {
		go o.runPolling()
	}

	if polling {
		return "开始轮询..."
	}
	return "取消轮询..."
}

// runPolling executes the polling loop
func (o *Order) runPolling() {
	log.Println("开始轮询下单")
	pollingStart := time.Now().UnixMilli()
	const timeout = 15000 // 15 seconds timeout for Weidian

	// For Youzan, use different timeout
	timeoutMs := timeout
	if !o.isWeidian {
		timeoutMs = 10000 // 10 seconds for Youzan
	}

	for o.isPolling() && (time.Now().UnixMilli()-pollingStart) < int64(timeoutMs) {
		currentStart := time.Now().UnixMilli()

		// Determine combine mode
		// For Weidian: combine for first 8 seconds
		// For Youzan: combine for first 3 seconds
		elapsed := currentStart - pollingStart
		combine := false

		if o.isWeidian {
			combine = elapsed < 8000
		} else {
			combine = elapsed < 3000
		}

		// Create orders
		_, err := o.CreateOrder(combine)
		if err != nil {
			log.Printf("下单异常: %v", err)
		}

		// Calculate wait time
		executionTime := time.Now().UnixMilli() - currentStart
		delay := int64(o.interval) - executionTime

		if o.isPolling() && delay > 0 {
			log.Printf("等待 %d ms", delay)
			time.Sleep(time.Duration(delay) * time.Millisecond)
		}
	}

	// Polling ended
	log.Println("轮询流程结束")
	o.pollingMutex.Lock()
	o.polling = false
	o.pollingMutex.Unlock()
}

// isPolling checks if polling is active
func (o *Order) isPolling() bool {
	o.pollingMutex.RLock()
	defer o.pollingMutex.RUnlock()
	return o.polling
}

// TargetOrder executes target-time orders for all tasks
func (o *Order) TargetOrder() []*model.TargetStatusResult {
	currentTimestamp := time.Now().UnixMilli()

	var wg sync.WaitGroup
	results := make([]*model.TargetStatusResult, len(o.tasks))

	for i, task := range o.tasks {
		wg.Add(1)
		go func(idx int, t *OrderTask) {
			defer wg.Done()
			results[idx] = t.CheckTargetTime(currentTimestamp)
		}(i, task)
	}

	wg.Wait()
	return results
}

// GetPollingStatus returns the current polling status
func (o *Order) GetPollingStatus() (bool, int) {
	o.pollingMutex.RLock()
	defer o.pollingMutex.RUnlock()
	return o.polling, o.interval
}

// StopAllTasks stops all running tasks
func (o *Order) StopAllTasks() {
	for _, task := range o.tasks {
		task.StopTask()
	}
}

// GetRunningTasksCount returns the number of currently running tasks
func (o *Order) GetRunningTasksCount() int {
	count := 0
	for _, task := range o.tasks {
		if task.IsRunning() {
			count++
		}
	}
	return count
}
