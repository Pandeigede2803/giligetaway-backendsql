# Discount Flow - Agent API

Date: 2026-01-21

## Summary
Discount applies only to `ticket_total`. Transport is excluded from discount and added after.

## Endpoints
- POST `/api/agent-access/book/v1`
- POST `/api/agent-access/round-trip-book/v1`

## Flow (One-way)
1) Calculate `ticket_total` from schedule + passengers
2) Calculate `transport_total`
3) If `discount_code` valid, compute `discount_amount` from `ticket_total`
4) `ticket_total_after_discount = max(0, ticket_total - discount_amount)`
5) `gross_total = ticket_total_after_discount + transport_total`
6) Create booking + transaction + commission using `gross_total`

## Flow (Round-trip)
- Same logic per leg (departure and return)
- `total_gross` = sum of discounted `gross_total` per leg
- `total_discount` = sum of `discount_amount` per leg

## Final Total Formula
```
ticket_total = calculated from schedule + passengers
transport_total = sum(transport_price * quantity)
discount_amount = calculated from ticket_total
ticket_total_after_discount = max(0, ticket_total - discount_amount)
gross_total = ticket_total_after_discount + transport_total
```

## Manual Test Cases
1) ticket_total 1,000,000; transport_total 100,000; discount 10% =>
   discount_amount 100,000; gross_total 1,000,000
2) ticket_total 750,000; transport_total 50,000; discount fixed 200,000 =>
   gross_total 600,000
3) min_purchase 500,000; ticket_total 450,000; transport_total 300,000 =>
   discount NOT applied

## Notes
- Commission uses discounted `gross_total`.
- Transport is never discounted.
