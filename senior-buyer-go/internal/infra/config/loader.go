package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/zhoukaidong/senior-buyer-go/internal/domain/model"
)

// ConfigPath is the default path to the configuration directory
const DefaultConfigPath = "./configs"

// Loader handles loading configuration from JSON files
type Loader struct {
	configPath string
}

// NewLoader creates a new configuration loader
func NewLoader(configPath string) *Loader {
	if configPath == "" {
		configPath = DefaultConfigPath
	}
	return &Loader{
		configPath: configPath,
	}
}

// LoadWeidianConfig loads Weidian configuration from weidian.json
func (l *Loader) LoadWeidianConfig() ([]model.TaskConfig, error) {
	configFile := filepath.Join(l.configPath, "weidian.json")
	return l.loadConfig(configFile)
}

// LoadYouzanConfig loads Youzan configuration from youzan.json
func (l *Loader) LoadYouzanConfig() ([]model.TaskConfig, error) {
	configFile := filepath.Join(l.configPath, "youzan.json")
	return l.loadConfig(configFile)
}

// loadConfig is the generic configuration loader
func (l *Loader) loadConfig(configFile string) ([]model.TaskConfig, error) {
	// Read the configuration file
	data, err := os.ReadFile(configFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", configFile, err)
	}

	// Parse JSON
	var configs []model.TaskConfig
	if err := json.Unmarshal(data, &configs); err != nil {
		return nil, fmt.Errorf("failed to parse config file %s: %w", configFile, err)
	}

	// Parse target timestamps
	for i := range configs {
		timestamp, err := configs[i].ParseTargetTime()
		if err != nil {
			return nil, fmt.Errorf("failed to parse target time in config %d: %w", i, err)
		}
		configs[i].TargetTimestamp = timestamp
	}

	return configs, nil
}

// SaveWeidianConfig saves Weidian configuration to weidian.json
func (l *Loader) SaveWeidianConfig(configs []model.TaskConfig) error {
	configFile := filepath.Join(l.configPath, "weidian.json")
	return l.saveConfig(configFile, configs)
}

// SaveYouzanConfig saves Youzan configuration to youzan.json
func (l *Loader) SaveYouzanConfig(configs []model.TaskConfig) error {
	configFile := filepath.Join(l.configPath, "youzan.json")
	return l.saveConfig(configFile, configs)
}

// saveConfig is the generic configuration saver
func (l *Loader) saveConfig(configFile string, configs []model.TaskConfig) error {
	// Marshal to JSON with indentation
	data, err := json.MarshalIndent(configs, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(configFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file %s: %w", configFile, err)
	}

	return nil
}
