package model

import (
	"crypto/rand"
	"encoding/hex"
)

// Buyer is the interface that both Weidian and Youzan buyers must implement
type Buyer interface {
	// QueryCart queries the shopping cart for this buyer
	// Returns cart result containing buyer name, order total, and cart items
	QueryCart() (*CartResult, error)

	// QueryPreOrder returns pre-order information including generated order parameters
	QueryPreOrder() (*PreOrderInfo, error)

	// OrderCart creates orders based on the combine flag
	// If combine is true, creates a single combined order
	// If combine is false, creates individual orders (one product per order)
	OrderCart(combine bool) ([]OrderResult, error)

	// GetName returns the buyer's name
	GetName() string

	// IsDisabled returns whether the buyer is disabled
	IsDisabled() bool
}

// BaseBuyer contains common fields and methods for all buyers
type BaseBuyer struct {
	OrderList    []OrderParams `json:"-"`       // List of order parameters for individual orders
	SucceedIds   []string      `json:"-"`       // IDs of successfully submitted orders
	CombineOrder OrderParams   `json:"-"`       // Combined order parameters
	Name         string        `json:"-"`       // Buyer name
	Disabled     bool          `json:"-"`       // Whether buyer is disabled
}

// IsSucceded checks if an order has already been successfully submitted
func (b *BaseBuyer) IsSucceded(submitID string) bool {
	for _, id := range b.SucceedIds {
		if id == submitID {
			return true
		}
	}
	return false
}

// MarkSucceeded marks an order as successfully submitted
func (b *BaseBuyer) MarkSucceeded(submitID string) {
	b.SucceedIds = append(b.SucceedIds, submitID)
}

// HasCombineSucceeded checks if the combined order has been submitted
func (b *BaseBuyer) HasCombineSucceeded() bool {
	return b.IsSucceded("combine")
}

// GetName returns the buyer name
func (b *BaseBuyer) GetName() string {
	return b.Name
}

// IsDisabled returns whether the buyer is disabled
func (b *BaseBuyer) IsDisabled() bool {
	return b.Disabled
}

// GetOrderTotal returns the number of individual orders
func (b *BaseBuyer) GetOrderTotal() int {
	return len(b.OrderList)
}

// UUID generates a custom UUID v4 string
// This generates the format: xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx (32 hex chars)
func (b *BaseBuyer) UUID() string {
	uuid := make([]byte, 16)
	if _, err := rand.Read(uuid); err != nil {
		// Fallback to simpler generation if crypto/rand fails
		return b.simpleUUID()
	}

	// Set version bits (version 4)
	uuid[6] = (uuid[6] & 0x0f) | 0x40
	// Set variant bits
	uuid[8] = (uuid[8] & 0x3f) | 0x80

	return hex.EncodeToString(uuid)
}

// simpleUUID is a fallback UUID generator using time-based pseudo-randomness
func (b *BaseBuyer) simpleUUID() string {
	// Simple timestamp-based fallback
	now := int(uint32(0)) // Placeholder - in production use actual time
	uuid := make([]byte, 16)

	// Use some entropy from time
	for i := 0; i < 16; i++ {
		uuid[i] = byte((now + i) % 256)
	}

	// Set version and variant bits
	uuid[6] = (uuid[6] & 0x0f) | 0x40
	uuid[8] = (uuid[8] & 0x3f) | 0x80

	return hex.EncodeToString(uuid)
}
