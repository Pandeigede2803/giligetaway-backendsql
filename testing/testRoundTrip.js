// testing/testRoundTrip.js
const axios = require('axios');

// ============================================
// Configuration
// ============================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'b6a0217a38c9cb61f4a1dbf81c44fac434b4872ba3f1399942859fc5bb950127';

// ============================================
// Test Data
// ============================================
const roundTripBookingData = {
  agent_id: 257,
  api_key: API_KEY,
  departure: {
    schedule_id: 38,
    subschedule_id: 47,
    total_passengers: 1,
    booking_date: "2025-01-31",
    gross_total: 775200,
    ticket_total: 760000,
    payment_status: "pending",
    contact_name: "Pande Sudiahna",
    contact_phone: "+6281238266915",
    contact_passport_id: "1212124",
    contact_nationality: "CH",
    contact_email: "Bajuboss21@gmail.com",
    adult_passengers: 1,
    child_passengers: 0,
    infant_passengers: 0,
    ticket_id: "GG-RT-82339",
    bank_fee: 15504,
    currency: "IDR",
    gross_total_in_usd: "47.67",
    exchange_rate: 16261.8,
    passengers: [
      {
        name: "qadasdasd",
        nationality: "Switzerland",
        passport_id: "none",
        passenger_type: "adult",
        seat_number_departure: "G1",
        seat_number_return: "F4"
      }
    ],
    transports: [
      {
        transport_id: 48,
        quantity: 1,
        transport_price: 0,
        transport_type: "pickup",
        note: ""
      },
      {
        transport_id: 49,
        quantity: 1,
        transport_price: 0,
        transport_type: "dropoff",
        note: ""
      }
    ],
    transaction_type: "debit"
  },
  return: {
    schedule_id: 39,
    subschedule_id: 41,
    total_passengers: 1,
    booking_date: "2025-02-04",
    gross_total: 775200,
    ticket_total: 760000,
    payment_status: "pending",
    contact_name: "Pande Sudiahna",
    contact_phone: "+6281238266915",
    contact_passport_id: "1212124",
    contact_nationality: "CH",
    contact_email: "Bajuboss21@gmail.com",
    adult_passengers: 1,
    child_passengers: 0,
    infant_passengers: 0,
    ticket_id: "GG-RT-59069",
    bank_fee: 15504,
    currency: "IDR",
    gross_total_in_usd: "47.67",
    exchange_rate: 16261.8,
    passengers: [
      {
        name: "qadasdasd",
        nationality: "Switzerland",
        passport_id: "none",
        passenger_type: "adult",
        seat_number_departure: "G1",
        seat_number_return: "F4"
      }
    ],
    transports: [
      {
        transport_id: 49,
        quantity: 1,
        transport_price: 0,
        transport_type: "dropoff",
        note: ""
      }
    ],
    transaction_type: "debit"
  }
};

// ============================================
// Test Function
// ============================================
async function testRoundTripBooking() {
  console.log('\n========================================');
  console.log('Testing Round-Trip Agent Booking');
  console.log('========================================\n');

  console.log('URL:', `${BASE_URL}/api/agent-access/round-trip-book/v1`);
  console.log('Request Data:', JSON.stringify(roundTripBookingData, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/api/agent-access/round-trip-book/v1`,
      roundTripBookingData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('\n❌ ERROR!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received from server');
      console.log('Error:', error.message);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Run the test
testRoundTripBooking();
