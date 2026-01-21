# Discount Applies to Ticket Only (Transport Excluded)

Date: 2026-01-21

## Summary
Discount is applied only to `ticket_total`. Transport charges are added after the discount.

## Final Total Formula
```
ticket_total = calculated from schedule + passengers
transport_total = sum(transport_price * quantity)
discount_amount = calculated from ticket_total
ticket_total_after_discount = max(0, ticket_total - discount_amount)
gross_total = ticket_total_after_discount + transport_total
```

## Manual Test Cases

1) One-way with transport + percentage discount
- ticket_total = 1,000,000
- transport_total = 100,000
- discount = 10% of ticket_total = 100,000
- ticket_total_after_discount = 900,000
- gross_total = 1,000,000

2) One-way with transport + fixed discount
- ticket_total = 750,000
- transport_total = 50,000
- discount = 200,000
- ticket_total_after_discount = 550,000
- gross_total = 600,000

3) Minimum purchase check (ticket only)
- min_purchase = 500,000
- ticket_total = 450,000
- transport_total = 300,000
- result: discount NOT applied (ticket_total < min_purchase)

4) Round-trip (per leg discount)
- departure: ticket_total 800,000; transport_total 100,000; discount 10% = 80,000
  gross_total = 820,000
- return: ticket_total 700,000; transport_total 0; discount fixed 50,000
  gross_total = 650,000
- total_gross = 1,470,000; total_discount = 130,000

## Affected Endpoints
- POST `/api/agent-access/book/v1`
- POST `/api/agent-access/round-trip-book/v1`

## Notes
- Commission is still calculated from discounted `gross_total`.
- Transport is never discounted.
