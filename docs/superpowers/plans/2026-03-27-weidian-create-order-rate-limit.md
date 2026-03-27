# Weidian Create Order Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove polling `interval` control and cap `creatOrder` throughput to at most 40 calls in any rolling 1000ms window.

**Architecture:** Replace polling's interval-based pacing with a simple continuous loop bounded by timeout and manual stop. Add a shared sliding-window limiter used only by `Buyer.creatOrder()` so all buyers/tasks in the process share one global create-order budget.

**Tech Stack:** Node.js, CommonJS modules, node:test, existing Koa service code

---

### Task 1: Add failing limiter tests

**Files:**
- Create: `weidian/weidian-api/test/create-order-rate-limit.test.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Cover rolling-window cap and polling interval removal**

### Task 2: Implement shared create-order limiter

**Files:**
- Create: `weidian/weidian-api/service/create_order_limiter.js`
- Modify: `weidian/weidian-api/service/buyer.js`

- [ ] **Step 1: Add a sliding-window limiter for 40 requests / 1000ms**
- [ ] **Step 2: Call limiter only from `Buyer.creatOrder()`**
- [ ] **Step 3: Keep non-create-order APIs unthrottled**

### Task 3: Remove polling interval pacing

**Files:**
- Modify: `weidian/weidian-api/service/order.js`

- [ ] **Step 1: Remove `interval` state and request param handling**
- [ ] **Step 2: Keep timeout and stop semantics**
- [ ] **Step 3: Let `createOrder()` pacing be governed by the limiter**

### Task 4: Verify

**Files:**
- Test: `weidian/weidian-api/test/create-order-rate-limit.test.js`

- [ ] **Step 1: Run targeted tests**
- [ ] **Step 2: Confirm new limiter behavior with fresh output**
