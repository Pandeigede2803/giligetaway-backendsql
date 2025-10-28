// testing/agentApiTest.js
const axios = require('axios');

// ============================================
// Configuration
// ============================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'b6a0217a38c9cb61f4a1dbf81c44fac434b4872ba3f1399942859fc5bb950127';

const config = {
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
  }
};

// ============================================
// Test Data Templates
// ============================================

/**
 * Template for one-way agent booking
 */
const oneWayBookingTemplate = {
  schedule_id: 1,
  subschedule_id: null, // Optional: set to null for main schedule or provide subschedule ID
  departure_date: '2025-10-25',
  adult_passengers: 2,
  child_passengers: 1,
  infant_passengers: 0,
  total_passengers: 3,
  contact_name: 'John Doe',
  contact_phone: '+628123456789',
  contact_email: 'johndoe@example.com',
  contact_nationality: 'Indonesian',
  agent_id: 257,
  api_key: API_KEY,
  currency: 'IDR',
  transaction_type: 'booking',
  transports: [
    {
      transport_id: 1,
      transport_price: 50000,
      quantity: 1
    }
  ]
};

/**
 * Template for round-trip agent booking
 */
const roundTripBookingTemplate = {
  agent_id: 257,
  api_key: API_KEY,
  departure: {
    schedule_id: 1,
    subschedule_id: null,
    booking_date: '2025-10-25',
    adult_passengers: 2,
    child_passengers: 1,
    infant_passengers: 0,
    total_passengers: 3,
    contact_name: 'Jane Smith',
    contact_phone: '+628123456789',
    contact_email: 'janesmith@example.com',
    contact_nationality: 'Indonesian',
    currency: 'IDR',
    transaction_type: 'booking',
    passengers: [
      {
        name: 'Jane Smith',
        nationality: 'Indonesian',
        passenger_type: 'adult'
      },
      {
        name: 'John Smith',
        nationality: 'Indonesian',
        passenger_type: 'adult'
      },
      {
        name: 'Baby Smith',
        nationality: 'Indonesian',
        passenger_type: 'child'
      }
    ],
    transports: [
      {
        transport_id: 1,
        transport_price: 50000,
        quantity: 1
      }
    ]
  },
  return: {
    schedule_id: 2,
    subschedule_id: null,
    booking_date: '2025-10-30',
    adult_passengers: 2,
    child_passengers: 1,
    infant_passengers: 0,
    total_passengers: 3,
    contact_name: 'Jane Smith',
    contact_phone: '+628123456789',
    contact_email: 'janesmith@example.com',
    contact_nationality: 'Indonesian',
    currency: 'IDR',
    transaction_type: 'booking',
    passengers: [
      {
        name: 'Jane Smith',
        nationality: 'Indonesian',
        passenger_type: 'adult'
      },
      {
        name: 'John Smith',
        nationality: 'Indonesian',
        passenger_type: 'adult'
      },
      {
        name: 'Baby Smith',
        nationality: 'Indonesian',
        passenger_type: 'child'
      }
    ],
    transports: [
      {
        transport_id: 1,
        transport_price: 50000,
        quantity: 1
      }
    ]
  }
};

// ============================================
// Test Functions
// ============================================

/**
 * Test one-way agent booking
 */
async function testOneWayBooking(customData = {}) {
  console.log('\n========================================');
  console.log('Testing One-Way Agent Booking');
  console.log('========================================\n');

  const bookingData = { ...oneWayBookingTemplate, ...customData };

  console.log('Request Data:', JSON.stringify(bookingData, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/api/agent-access/book/v1`,
      bookingData,
      config
    );

    console.log('\n✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('\n❌ Error!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
      return { success: false, error: error.response.data };
    } else {
      console.log('Error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Test round-trip agent booking
 */
async function testRoundTripBooking(customData = {}) {
  console.log('\n========================================');
  console.log('Testing Round-Trip Agent Booking');
  console.log('========================================\n');

  const bookingData = {
    agent_id: customData.agent_id || roundTripBookingTemplate.agent_id,
    departure: { ...roundTripBookingTemplate.departure, ...(customData.departure || {}) },
    return: { ...roundTripBookingTemplate.return, ...(customData.return || {}) }
  };

  console.log('Request Data:', JSON.stringify(bookingData, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/api/agent-access/round-trip-book/v1`,
      bookingData,
      config
    );

    console.log('\n✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log('\n❌ Error!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
      return { success: false, error: error.response.data };
    } else {
      console.log('Error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Test validation errors for one-way booking
 */
async function testOneWayValidationErrors() {
  console.log('\n========================================');
  console.log('Testing One-Way Validation Errors');
  console.log('========================================\n');

  const testCases = [
    {
      name: 'Missing schedule_id',
      data: { ...oneWayBookingTemplate, schedule_id: null }
    },
    {
      name: 'Invalid agent_id',
      data: { ...oneWayBookingTemplate, agent_id: 99999 }
    },
    {
      name: 'Passenger count mismatch',
      data: { ...oneWayBookingTemplate, total_passengers: 5 }
    },
    {
      name: 'Invalid transport_price',
      data: {
        ...oneWayBookingTemplate,
        transports: [{ transport_id: 1, transport_price: 'invalid', quantity: 1 }]
      }
    }
  ];

  const results = [];
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('---');
    const result = await testOneWayBooking(testCase.data);
    results.push({ ...testCase, result });
  }

  console.log('\n========================================');
  console.log('Validation Test Summary');
  console.log('========================================\n');
  results.forEach(({ name, result }) => {
    console.log(`${name}: ${result.success ? '❌ Unexpected Success' : '✅ Expected Error'}`);
  });
}

/**
 * Test validation errors for round-trip booking
 */
async function testRoundTripValidationErrors() {
  console.log('\n========================================');
  console.log('Testing Round-Trip Validation Errors');
  console.log('========================================\n');

  const testCases = [
    {
      name: 'Missing departure data',
      data: { agent_id: 1, return: roundTripBookingTemplate.return }
    },
    {
      name: 'Missing return data',
      data: { agent_id: 1, departure: roundTripBookingTemplate.departure }
    },
    {
      name: 'Invalid agent_id',
      data: { ...roundTripBookingTemplate, agent_id: 99999 }
    },
    {
      name: 'Departure passenger array mismatch',
      data: {
        ...roundTripBookingTemplate,
        departure: {
          ...roundTripBookingTemplate.departure,
          passengers: []
        }
      }
    }
  ];

  const results = [];
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('---');
    const result = await testRoundTripBooking(testCase.data);
    results.push({ ...testCase, result });
  }

  console.log('\n========================================');
  console.log('Validation Test Summary');
  console.log('========================================\n');
  results.forEach(({ name, result }) => {
    console.log(`${name}: ${result.success ? '❌ Unexpected Success' : '✅ Expected Error'}`);
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('========================================');
  console.log('Agent Booking API Test Suite');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);

  try {
    // Test successful bookings
    await testOneWayBooking();
    await testRoundTripBooking();

    // Test validation errors
    await testOneWayValidationErrors();
    await testRoundTripValidationErrors();

    console.log('\n========================================');
    console.log('All Tests Completed');
    console.log('========================================\n');
  } catch (error) {
    console.error('\nTest suite error:', error.message);
  }
}

// ============================================
// CLI Interface
// ============================================

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'one-way') {
  testOneWayBooking();
} else if (command === 'round-trip') {
  testRoundTripBooking();
} else if (command === 'validate-one-way') {
  testOneWayValidationErrors();
} else if (command === 'validate-round-trip') {
  testRoundTripValidationErrors();
} else if (command === 'all' || !command) {
  runAllTests();
} else {
  console.log('Usage: node agentApiTest.js [command]');
  console.log('\nCommands:');
  console.log('  one-way               - Test one-way booking');
  console.log('  round-trip            - Test round-trip booking');
  console.log('  validate-one-way      - Test one-way validation errors');
  console.log('  validate-round-trip   - Test round-trip validation errors');
  console.log('  all                   - Run all tests (default)');
  console.log('\nEnvironment Variables:');
  console.log('  BASE_URL              - API base URL (default: http://localhost:3000)');
  console.log('  API_KEY               - API key for authentication');
}

// Export functions for use in other test files
module.exports = {
  testOneWayBooking,
  testRoundTripBooking,
  testOneWayValidationErrors,
  testRoundTripValidationErrors,
  runAllTests,
  oneWayBookingTemplate,
  roundTripBookingTemplate
};
