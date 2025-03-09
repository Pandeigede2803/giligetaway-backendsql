const axios = require('axios');

const getExchangeRate = async (currency = "IDR") => {
  try {
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${currency}`);
    
    if (response.data && response.data.rates && response.data.rates.USD) {
      return response.data.rates.USD; // Return the exchange rate IDR → USD
    } else {
      throw new Error("Invalid exchange rate data");
    }
  } catch (error) {
    console.error("Error fetching exchange rate:", error.message);
    throw new Error("Failed to fetch exchange rate");
  }
};

module.exports = getExchangeRate;
