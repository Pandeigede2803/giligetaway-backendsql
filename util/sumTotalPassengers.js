const { sequelize, Booking, SeatAvailability,Destination,Transport, Schedule,SubSchedule,Transaction, Passenger,Transit, TransportBooking, AgentMetrics, Agent, BookingSeatAvailability, Boat } = require('../models');

const sumTotalPassengers = (bookingSeatAvailabilities) => {
    return bookingSeatAvailabilities.reduce((total, bookingSeatAvailability) => {
      return total + (bookingSeatAvailability.Booking?.total_passengers || 0);
    }, 0);
  };

  module.exports = { sumTotalPassengers }


//   This code defines a function sumTotalPassengers that takes an array of BookingSeatAvailability objects and calculates the total number of passengers by summing up the total_passengers value from each associated Booking record.

// Here’s a detailed explanation of each part:

// sumTotalPassengers = (bookingSeatAvailabilities) => {:

// This is an arrow function that accepts an array bookingSeatAvailabilities, which contains objects representing seat availability for bookings. Each object includes data about seat availability and its relation to bookings.
// return bookingSeatAvailabilities.reduce((total, bookingSeatAvailability) => {:

// This uses the reduce method to iterate over the bookingSeatAvailabilities array and accumulate the total number of passengers.
// reduce takes two arguments:
// total: This variable keeps a running sum of passengers.
// bookingSeatAvailability: This represents each item (or object) in the bookingSeatAvailabilities array.
// return total + (bookingSeatAvailability.Booking?.total_passengers || 0);:

// For each bookingSeatAvailability object, the function checks if it has an associated Booking record (using the optional chaining operator ?.).
// If the Booking exists, it retrieves the value of total_passengers from the Booking and adds it to the total sum.
// If the Booking does not exist (i.e., bookingSeatAvailability.Booking is undefined), it defaults to 0 (the || 0 part ensures this).
// In simple terms, for each booking seat availability record, the function extracts the number of passengers from the associated booking and adds that to the running total.
// }, 0);:

// This 0 is the initial value of the total accumulator, meaning the total starts at 0.
// The reduce function completes the iteration over all the items in the array and returns the final accumulated total value, representing the sum of passengers across all booking seat availability records.
// Summary:
// This function takes an array of BookingSeatAvailability objects.
// It loops through each object, extracts the number of passengers from the associated Booking (if it exists), and adds them up.
// It returns the total number of passengers across all the provided booking seat availabilities. If a booking is missing or does not have passengers, it safely defaults to 0.





// You said:
// bahasa indonesia
// ChatGPT said:
// ChatGPT
// Kode ini mendefinisikan sebuah fungsi sumTotalPassengers yang menerima array dari objek BookingSeatAvailability dan menghitung jumlah total penumpang dengan menjumlahkan nilai total_passengers dari setiap record Booking yang terkait.

// Berikut penjelasan tiap bagian kode:

// sumTotalPassengers = (bookingSeatAvailabilities) => {:

// Ini adalah fungsi arrow yang menerima parameter berupa array bookingSeatAvailabilities. Setiap elemen dari array ini berisi objek yang mewakili ketersediaan kursi untuk pemesanan (booking), termasuk informasi terkait dengan pemesanan.
// return bookingSeatAvailabilities.reduce((total, bookingSeatAvailability) => {:

// Fungsi ini menggunakan metode reduce untuk menjumlahkan total penumpang.
// reduce mengambil dua argumen:
// total: Variabel yang menyimpan akumulasi jumlah penumpang.
// bookingSeatAvailability: Setiap elemen atau objek dari array bookingSeatAvailabilities yang sedang diolah.
// return total + (bookingSeatAvailability.Booking?.total_passengers || 0);:

// Untuk setiap objek bookingSeatAvailability, fungsi ini memeriksa apakah ada data Booking yang terkait (dengan menggunakan operator opsional ?. untuk menghindari error jika tidak ada).
// Jika ada, maka nilai total_passengers dari objek Booking tersebut diambil dan ditambahkan ke variabel total.
// Jika tidak ada (misalnya, bookingSeatAvailability.Booking tidak ada atau undefined), maka akan menambahkan 0 ke total (dengan menggunakan || 0 sebagai nilai default).
// }, 0);:

// Nilai 0 di sini adalah nilai awal dari akumulator total. Jadi, proses penjumlahan dimulai dari angka 0.
// Setelah iterasi pada semua elemen dalam array selesai, reduce akan mengembalikan nilai akhir dari total, yaitu jumlah total penumpang.
// Ringkasan:
// Fungsi ini menerima array dari objek BookingSeatAvailability.
// Fungsi akan memeriksa setiap objek dan mengambil jumlah penumpang dari data Booking yang terkait, kemudian menjumlahkan semuanya.
// Jika suatu pemesanan tidak memiliki data penumpang atau booking, maka akan dianggap jumlah penumpangnya 0.
// Fungsi ini mengembalikan total seluruh penumpang yang ada berdasarkan data ketersediaan kursi yang diberikan.