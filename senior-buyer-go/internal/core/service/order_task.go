package service

import (
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/zhoukaidong/senior-buyer-go/internal/domain/model"
	"github.com/zhoukaidong/senior-buyer-go/internal/platform/weidian"
	"github.com/zhoukaidong/senior-buyer-go/internal/platform/youzan"
)

// OrderTask represents a timed purchasing task
type OrderTask struct {
	config     *model.TaskConfig
	buyers     []model.Buyer
	running    bool
	mu         sync.RWMutex
	stopSignal chan struct{}
}

// NewOrderTask creates a new order task from configuration
func NewOrderTask(config *model.TaskConfig, isWeidian bool) *OrderTask {
	task := &OrderTask{
		config:     config,
		buyers:     make([]model.Buyer, 0),
		running:    false,
		stopSignal: make(chan struct{}),
	}

	// Create buyers from configuration
	for _, buyerConfig := range config.Buyers {
		if buyerConfig.IsDisabled() {
			continue
		}

		var buyer model.Buyer
		if isWeidian {
			buyer = weidian.NewBuyer(buyerConfig.Weidian)
		} else {
			buyer = youzan.NewBuyer(buyerConfig.Youzan)
		}

		task.buyers = append(task.buyers, buyer)
	}

	return task
}

// GetConfig returns the task configuration
func (t *OrderTask) GetConfig() *model.TaskConfig {
	return t.config
}

// QueryCart queries shopping carts for all buyers
func (t *OrderTask) QueryCart() ([]*model.CartResult, error) {
	var wg sync.WaitGroup
	results := make([]*model.CartResult, len(t.buyers))
	errors := make([]error, len(t.buyers))

	for i, buyer := range t.buyers {
		wg.Add(1)
		go func(idx int, b model.Buyer) {
			defer wg.Done()
			result, err := b.QueryCart()
			results[idx] = result
			errors[idx] = err
		}(i, buyer)
	}

	wg.Wait()

	// Return results even if some failed
	return results, nil
}

// CreateOrder creates orders for all buyers
func (t *OrderTask) CreateOrder(combine bool) ([][]model.OrderResult, error) {
	var wg sync.WaitGroup
	results := make([][]model.OrderResult, len(t.buyers))
	errors := make([]error, len(t.buyers))

	for i, buyer := range t.buyers {
		wg.Add(1)
		go func(idx int, b model.Buyer) {
			defer wg.Done()
			result, err := b.OrderCart(combine)
			results[idx] = result
			errors[idx] = err
		}(i, buyer)
	}

	wg.Wait()

	return results, nil
}

// QueryPreOrder queries pre-order information for all buyers
func (t *OrderTask) QueryPreOrder() ([]*model.PreOrderInfo, error) {
	var wg sync.WaitGroup
	results := make([]*model.PreOrderInfo, len(t.buyers))
	errors := make([]error, len(t.buyers))

	for i, buyer := range t.buyers {
		wg.Add(1)
		go func(idx int, b model.Buyer) {
			defer wg.Done()
			result, err := b.QueryPreOrder()
			results[idx] = result
			errors[idx] = err
		}(i, buyer)
	}

	wg.Wait()

	return results, nil
}

// StartTask starts the task execution with three-phase strategy
// Phase 1: Wait until advancePostInterval before target time
// Phase 2: Execute advance postings at advancePostInterval intervals
// Phase 3: Execute final postings at postInterval intervals for postDuration ms
func (t *OrderTask) StartTask(diffTimestamp int64) error {
	log.Printf("任务开始执行... diffTimestamp=%d", diffTimestamp)

	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return nil // Already running
	}
	t.running = true
	t.stopSignal = make(chan struct{})
	t.mu.Unlock()

	defer func() {
		t.mu.Lock()
		t.running = false
		t.mu.Unlock()
	}()

	// Query cart first
	_, err := t.QueryCart()
	if err != nil {
		log.Printf("查询购物车失败: %v", err)
	}

	advanceTimestamps := int64(t.config.AdvanceTimestamps)
	advancePostInterval := int64(t.config.AdvancePostInterval)
	postDuration := int64(t.config.PostDuration)
	postInterval := int64(t.config.PostInterval)

	// Phase 1: Wait if needed
	if diffTimestamp > advancePostInterval {
		waitTime := diffTimestamp - advancePostInterval
		log.Printf("阶段 1: 等待 %d ms", waitTime)

		select {
		case <-time.After(time.Duration(waitTime) * time.Millisecond):
		case <-t.stopSignal:
			log.Println("任务被停止 (阶段 1)")
			return nil
		}
	}

	// Phase 2: Advance phase
	remainingTimestamps := advanceTimestamps
	if remainingTimestamps > diffTimestamp {
		remainingTimestamps = diffTimestamp
	}

	if remainingTimestamps > advancePostInterval {
		log.Printf("阶段 2: 提前阶段, 剩余 %d ms, 间隔 %d ms", remainingTimestamps, advancePostInterval)

		ticker := time.NewTicker(time.Duration(advancePostInterval) * time.Millisecond)
		defer ticker.Stop()

		for remainingTimestamps >= advancePostInterval {
			select {
			case <-ticker.C:
				remainingTimestamps -= advancePostInterval
				log.Printf("提前阶段执行中... 剩余 %d ms", remainingTimestamps)
			case <-t.stopSignal:
				log.Println("任务被停止 (阶段 2)")
				return nil
			}
		}
	}

	// Phase 3: Sprint phase
	log.Printf("阶段 3: 冲刺阶段, 持续 %d ms, 间隔 %d ms", postDuration, postInterval)

	ticker := time.NewTicker(time.Duration(postInterval) * time.Millisecond)
	defer ticker.Stop()

	postDurationStocks := int64(0)
	sprintStartTime := time.Now()

	for postDurationStocks < postDuration {
		select {
		case <-ticker.C:
			postDurationStocks += postInterval
			elapsed := time.Since(sprintStartTime).Milliseconds()
			log.Printf("冲刺阶段执行中... 已执行 %d ms / %d ms", elapsed, postDuration)

			// Execute order creation here if needed
			// This is where actual order posting would happen

		case <-t.stopSignal:
			log.Printf("任务被停止 (阶段 3), 已执行 %d ms", postDurationStocks)
			return nil
		}
	}

	log.Println("任务执行完成")
	return nil
}

// StopTask stops the task execution
func (t *OrderTask) StopTask() {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.running && t.stopSignal != nil {
		close(t.stopSignal)
		log.Println("发送停止信号...")
	}
	t.running = false
}

// CheckTargetTime checks if target time has been reached and starts task if appropriate
func (t *OrderTask) CheckTargetTime(currentTimestamp int64) *model.TargetStatusResult {
	t.mu.RLock()
	isRunning := t.running
	t.mu.RUnlock()

	if isRunning {
		return &model.TargetStatusResult{
			Status:  "running",
			Message: "任务正在运行中...",
		}
	}

	targetTimestamp := t.config.TargetTimestamp
	advanceTimestamps := int64(t.config.AdvanceTimestamps)

	if targetTimestamp < currentTimestamp {
		return &model.TargetStatusResult{
			Status:  "timeout",
			Message: "任务时间已过期！",
		}
	}

	diffTimestamp := targetTimestamp - currentTimestamp

	// Check if we should start (within advanceTimestamps window)
	if diffTimestamp > advanceTimestamps && diffTimestamp > 1000 {
		return &model.TargetStatusResult{
			Status:  "waiting",
			Message: formatWaitingMessage(diffTimestamp),
		}
	}

	// Start the task in a goroutine
	go func() {
		if err := t.StartTask(diffTimestamp); err != nil {
			log.Printf("启动任务失败: %v", err)
		}
	}()

	return &model.TargetStatusResult{
		Status:  "running",
		Message: "任务已开始执行！",
	}
}

// IsRunning returns whether the task is currently running
func (t *OrderTask) IsRunning() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.running
}

// formatWaitingMessage formats the waiting message
func formatWaitingMessage(diffMs int64) string {
	seconds := diffMs / 1000
	minutes := seconds / 60
	hours := minutes / 60

	if hours > 0 {
		return formatTimeMessage(hours, minutes%60, seconds%60)
	} else if minutes > 0 {
		return formatTimeMessage(0, minutes, seconds%60)
	}
	return formatTimeMessage(0, 0, seconds)
}

// formatTimeMessage formats a time duration message
func formatTimeMessage(hours, minutes, seconds int64) string {
	if hours > 0 {
		return "任务将在" + formatNumber(hours) + "小时" + formatNumber(minutes) + "分" + formatNumber(seconds) + "秒后开始执行！"
	} else if minutes > 0 {
		return "任务将在" + formatNumber(minutes) + "分" + formatNumber(seconds) + "秒后开始执行！"
	}
	return "任务将在" + formatNumber(seconds) + "秒后开始执行！"
}

// formatNumber formats a number for display
func formatNumber(n int64) string {
	return strconv.FormatInt(n, 10)
}
