# Agent API Search Schedule V3 Flow

## Overview
This document describes the request flow for the Agent public API endpoint that searches schedules and sub-schedules in the Gili Getaway Express booking backend (Express.js).

## Endpoint
- Method: GET
- Path: `/api/agent-access/search-schedule/v3`

## Auth and Access
- Public CORS is enabled for `/api/agent-access` (see `app.js`).
- Still requires valid `agent_id` and `api_key`, validated by middleware.

## Query Parameters
- `agent_id` (required) - Agent primary key
- `api_key` (required) - Agent API key
- `from` (required) - Destination ID (origin)
- `to` (required) - Destination ID (destination)
- `date` (required) - Travel date (expected `YYYY-MM-DD`)
- `passengers_total` (optional) - Integer passenger count filter

## High-Level Flow
1. **Route definition**: `routes/agentRoutesApi.js`
   - `validateApiKey` runs before the controller.
   - `validateAgentSearchDiscount` runs if `discount_code` is provided.
2. **Auth middleware**: `middleware/validateKey.js`
   - Reads `agent_id` and `api_key` from `req.query` or `req.body`.
   - Validates agent existence and API key match.
3. **Discount validation (optional)**: `middleware/validateAgentSearchDiscount.js`
   - Validates `discount_code` against agent authorization and date.
   - Uses the request `date` when available.
4. **Controller**: `controllers/scheduleController.js` -> `searchSchedulesAndSubSchedulesAgent`
   - Calls `getSchedulesAndSubSchedules(from, to, date)` in `util/querySchedulesHelper.js`.
   - Filters available results and applies optional `passengers_total` filter.
   - Formats and enriches schedules, then returns combined results.

## Detailed Flow (Controller + Helpers)
1. **Query schedules and sub-schedules**
   - `getSchedulesAndSubSchedules` computes `selectedDate` and day-of-week.
   - `querySchedules` and `querySubSchedules` load:
     - Destination info
     - Boat info (capacity, images, seat layout)
     - Transits
     - SeatAvailability for the requested date (optional)
2. **Create missing seat availability**
   - If no `SeatAvailability` row exists for the date, a new row is created.
   - Defaults: `available_seats` uses boat capacity, `availability = true`, `boost = false`.
3. **Normalize seat availability data**
   - `processSeatAvailabilityData` maps the seat availability into `dataValues.seatAvailability`.
4. **Get booked seats**
   - `getBookedSeatsOptimized` fetches seats via `BookingSeatAvailability` and `Passengers`.
   - Only considers bookings with payment status: `paid`, `invoiced`, `pending`, `unpaid`.
   - `processBookedSeats` expands seat pairs when `boost` is false.
   - `bookedSeatNumbers` is attached to each schedule/sub-schedule seat availability.
5. **Filter availability**
   - `filterAvailableSchedules` and `filterAvailableSubSchedules` keep only:
     - `seatAvailability.availability === true`
     - `available_seats > 0`
6. **Passenger count filter (optional)**
   - If `passengers_total` is provided, only schedules with enough seats remain.
   - If none match, a 200 response is returned with `seats_availability_issue: true`.
7. **Format response (legacy format)**
   - `formatSchedules` / `formatSubSchedules` add season-based pricing and normalize fields.
   - Seat availability fields `id`, `availability`, and `boost` are removed.
   - `bookedSeatNumbers` is copied into `seatAvailability`.
   - `net_price` is added per passenger using agent commission (independent of `passengers_total`):
     - If agent has `commission_rate`, commission is percentage of the per-passenger price.
     - Otherwise, commission uses fixed values per `trip_type` (per passenger).
8. **Route enrichment**
   - `formatRouteTimeline`, `formatRouteString`, `formatRouteSteps` add clear route info:
     - `route_timeline`, `route_description`, `route_steps`
     - `route_summary`, `route_type`, `stops_count`
   - Raw fields like `transits`, `departure_time`, `arrival_time`, `journey_time`, `check_in_time`
     are stripped from the final payload.
   - Boat details include seat layout and capacity (uses `published_capacity` when boost is false).
9. **Combine and return**
   - Schedules and sub-schedules are merged into `data.schedules`.
   - If `passengers_total` was provided, `passenger_count_requested` is also returned.

## Response (Simplified Example)
```json
{
  "status": "success",
  "data": {
    "schedules": [
      {
        "id": 123,
        "schedule_id": 123,
        "subschedule_id": "N/A",
        "from": "Gili Trawangan",
        "to": "Padang Bai",
        "price": 450000,
        "net_price": 425000,
        "seatAvailability": {
          "schedule_id": 123,
          "subschedule_id": "N/A",
          "available_seats": 18,
          "date": "11/20/2025",
          "bookedSeatNumbers": ["A1", "R1"]
        },
        "boat": {
          "id": 1,
          "name": "Gili Express",
          "capacity": 100,
          "image": "https://...",
          "seat_layout": {
            "inside_seats": ["A1", "A2"],
            "outside_seats": ["B1", "B2"],
            "rooftop_seats": ["R1", "R2"]
          }
        },
        "route_timeline": [
          { "type": "departure", "location": "Gili Trawangan", "time": "07:00", "action": "Depart from" },
          { "type": "arrival", "location": "Padang Bai", "time": "09:30", "action": "Arrive at" }
        ],
        "route_description": "07:00 Gili Trawangan -> 09:30 Padang Bai",
        "route_steps": [],
        "route_summary": "Gili Trawangan -> Padang Bai",
        "route_type": "direct",
        "stops_count": 2
      }
    ],
    "passenger_count_requested": 2
  }
}
```

Notes:
- `price` and `net_price` are numbers when available (otherwise `N/A`).
- `passengers_total` only affects filtering, not the per-passenger pricing fields.
- `seatAvailability.date` uses `toLocaleDateString()`, so the date format depends on server locale.
- `discount_activated` is `true` when a valid discount is applied to `net_price`.
- Discount validation uses the request `date` (expected `YYYY-MM-DD`) and compares it to discount `start_date`/`end_date`.
- If the request `date` is outside the discount range, the discount is ignored and only a log is emitted.
- Combined results can include direct schedules and connecting sub-schedules.

## Error Responses
- `400` - `agent_id` and `api_key` are required.
- `403` - Invalid API key.
- `404` - Agent not found.
- `500` - Internal server error.

## Related Files
- `app.js`
- `routes/agentRoutesApi.js`
- `middleware/validateKey.js`
- `controllers/scheduleController.js`
- `util/querySchedulesHelper.js`
- `util/formatSchedules.js`
- `util/seatUtils.js`
