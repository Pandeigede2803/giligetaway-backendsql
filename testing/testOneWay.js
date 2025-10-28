// testing/testOneWay.js
const axios = require('axios');

// ============================================
// Configuration
// ============================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'b6a0217a38c9cb61f4a1dbf81c44fac434b4872ba3f1399942859fc5bb950127';

// ============================================
// Test Data
// ============================================
const oneWayBookingData = {
  schedule_id: 38,
  subschedule_id: 47,
  departure_date: "2025-10-14",
  total_passengers: 5,
  agent_id: 257,
  api_key: API_KEY,
  currency: "IDR",
  transaction_type: "booking",
  adult_passengers: 2,
  child_passengers: 2,
  infant_passengers: 1,
  payment_method: "invoiced",
  booking_source: "agent",
  contact_name: "John Doe",
  contact_phone: "+628123456789",
  contact_passport_id: "A12345678",
  contact_nationality: "USA",
  contact_email: "john.doe@example.com",
  note: "Testing agent booking with 5 passengers",
  passengers: [
    {
      name: "John Doe",
      nationality: "USA",
      passport_id: "12345678",
      passenger_type: "adult"
    },
    {
      name: "Jane Doe",
      nationality: "USA",
      passport_id: "87654321",
      passenger_type: "adult"
    },
    {
      name: "Billy Doe",
      nationality: "USA",
      passport_id: "23456789",
      passenger_type: "child"
    },
    {
      name: "Sally Doe",
      nationality: "USA",
      passport_id: "34567890",
      passenger_type: "child"
    },
    {
      name: "Tommy Doe",
      nationality: "USA",
      passport_id: "45678901",
      passenger_type: "infant"
    }
  ],
  transports: [
    {
      transport_id: 48,
      quantity: 1,
      transport_price: 100000,
      transport_type: "pickup",
      note: "Pickup at McDonalds Sanur"
    }
  ]
};

// ============================================
// Test Function
// ============================================
async function testOneWayBooking() {
  console.log('\n========================================');
  console.log('Testing One-Way Agent Booking');
  console.log('========================================\n');

  console.log('URL:', `${BASE_URL}/api/agent-access/book/v1`);
  console.log('Request Data:', JSON.stringify(oneWayBookingData, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/api/agent-access/book/v1`,
      oneWayBookingData,
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
testOneWayBooking();
