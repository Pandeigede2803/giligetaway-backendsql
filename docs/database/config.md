# Config - Configuration Files

## Overview

Folder `config/` berisi konfigurasi untuk database, payment gateways, WebSocket server, dan lain-lain. Konfigurasi ini membaca dari environment variables dan menyediakan fungsi terpusat untuk koneksi dan setup.

## Config Files Index

| File | Description |
|------|-------------|
| database.js | Sequelize database connection |
| doku.js | DOKU payment gateway configuration |
| websocket.js | WebSocket server setup |

---

## Database Configuration

### config/database.js

**Purpose**: Mengatur koneksi database MySQL menggunakan Sequelize ORM dengan dukungan read/write replication.

**Features**:
- Environment-based configuration (development/production)
- Read/Write replication support (master-slave)
- Automatic authentication on startup
- Telegram notification on connection failure
- Timezone configuration (Asia/Makassar +08:00)
- Connection pooling for better performance

**Single Connection Mode** (Default):

Jika tidak ada konfigurasi replication, akan menggunakan single connection:

```env
DB_NAME=giligetaway
DB_USER=giligetaway_user
DB_PASSWORD=giligetawat09876
DB_HOST=103.183.74.238
DB_PORT=3306
DB_DIALECT=mysql
```

**Read/Write Replication Mode**:

Jika ada konfigurasi replication, Sequelize akan otomatis:
- **Write queries** (INSERT, UPDATE, DELETE) → dikirim ke Master
- **Read queries** (SELECT) → dikirim ke Read Replicas (round-robin)

**Configuration**:

Environment variables untuk read/write replication:

```env
# Write (Master)
DB_WRITE_HOST=103.183.74.238
DB_WRITE_USER=giligetaway_user
DB_WRITE_PASSWORD=giligetawat09876

# Read Replicas (Slaves)
DB_READ_HOST_1=103.189.235.230
DB_READ_USER_1=appuser
DB_READ_PASSWORD_1=giligetaway09876

# Additional replicas (optional)
# DB_READ_HOST_2=replica-2.example.com
# DB_READ_USER_2=read_user
# DB_READ_PASSWORD_2=read_password
```

**Usage in Code**:

```javascript
const { createDatabaseConfig } = require('./util/databaseConfig');

const DB_CONFIG = {
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: process.env.DB_DIALECT,
};

// Automatically detects and uses replication config if available
const sequelize = createDatabaseConfig(DB_CONFIG);
```

**Authentication**:

```javascript
sequelize.authenticate()
  .then(() => {
    console.log('Database connected: giligetaway (mysql) with read/write replication');
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    // Send Telegram notification on failure
    sendTelegramMessage(errorMessage);
  });
```

**Environment Variables Required**:

**Development**:
```env
DEV_DB_NAME=giligetaway_dev
DEV_DB_USER=root
DEV_DB_PASSWORD=password
DEV_DB_HOST=localhost
DEV_DB_PORT=3306
DEV_DB_DIALECT=mysql
```

**Production**:
```env
DB_NAME=giligetaway_prod
DB_USER=prod_user
DB_PASSWORD=prod_password
DB_HOST=prod_host
DB_PORT=3306
DB_DIALECT=mysql

# Read/Write Replication (optional but recommended for production)
DB_WRITE_HOST=master-host.example.com
DB_WRITE_USER=write_user
DB_WRITE_PASSWORD=write_password
DB_READ_HOST_1=replica-1.example.com
DB_READ_USER_1=read_user
DB_READ_PASSWORD_1=read_password
```

**Usage**:

```javascript
const sequelize = require('./config/database');
const Booking = require('./models/booking');

// Sync database (create tables if not exist)
sequelize.sync().then(() => {
  console.log('Database synced');
});

// Use in models
const Booking = sequelize.define('Booking', { /* ... */ });
```

**Connection Pooling**:

Read/Write replication menggunakan connection pooling dengan konfigurasi default:

```javascript
pool: {
  max: 20,        // Maximum connections in pool
  min: 5,         // Minimum connections in pool
  acquire: 30000, // Maximum time (ms) to acquire connection
  idle: 10000,    // Maximum time (ms) connection can be idle
}
```

**Important Notes**:

1. **Database-level replication harus disetup secara terpisah** - Sequelize hanya mengarahkan query, bukan mengelola replication
2. **Read replicas menggunakan round-robin scheduling** - Sequelize akan mendistribusikan SELECT queries ke semua available replicas
3. **Write queries selalu ke Master** - INSERT, UPDATE, DELETE akan selalu dikirim ke `DB_WRITE_HOST`
4. **Replica credentials opsional** - Jika `DB_READ_USER_X` dan `DB_READ_PASSWORD_X` tidak diset, akan menggunakan credentials utama
5. **Single connection akan digunakan** jika `DB_READ_HOST_1` dan `DB_WRITE_HOST` tidak diset

---

## Database Configuration Utilities

### util/databaseConfig.js

**Purpose**: Helper utility untuk membuat database configuration dengan dukungan read/write replication.

**Available Functions**:

```javascript
const { createDatabaseConfig, getConnectionSuccessLogs, getConnectionErrorLogs } = require('./util/databaseConfig');
```

**Function: createDatabaseConfig(baseConfig)**

Membuat instance Sequelize dengan konfigurasi yang sesuai (single connection atau read/write replication).

**Parameters**:
- `baseConfig` (Object): Konfigurasi database dasar
  - `database`: Nama database
  - `username`: Username database
  - `password`: Password database
  - `host`: Host database (untuk single connection)
  - `port`: Port database
  - `dialect`: Dialect database (mysql, postgres, dll)

**Returns**: Sequelize instance

**Example**:

```javascript
const { createDatabaseConfig } = require('./util/databaseConfig');

const DB_CONFIG = {
  database: 'giligetaway',
  username: 'giligetaway_user',
  password: 'password',
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
};

const sequelize = createDatabaseConfig(DB_CONFIG);
// sequelize akan otomatis menggunakan read/write replication jika env tersedia
```

**Function: getConnectionSuccessLogs(baseConfig, hasReplication)**

Membuat log string untuk koneksi database yang berhasil.

**Parameters**:
- `baseConfig` (Object): Konfigurasi database
- `hasReplication` (Boolean): Apakah replication aktif

**Returns**: String log

**Function: getConnectionErrorLogs(baseConfig, hasReplication, error)**

Membuat log string untuk koneksi database yang gagal.

**Parameters**:
- `baseConfig` (Object): Konfigurasi database
- `hasReplication` (Boolean): Apakah replication aktif
- `error` (Error): Error object

**Returns**: String log

**Internal Functions**:

```javascript
// Membuat konfigurasi single connection
function createSingleConnectionConfig(baseConfig)

// Membuat konfigurasi read/write replication
function createReplicationConfig(baseConfig)
```

---

## DOKU Payment Configuration

### config/doku.js

**Purpose**: Konfigurasi untuk integrasi payment gateway DOKU.

**Features**:
- Payment request signing
- Webhook signature validation
- API endpoint configuration
- Support for multiple payment methods

**Configuration**:

```javascript
const DOKU_CONFIG = {
  MERCHANT_ID: process.env.DOKU_MERCHANT_ID,
  SHARED_KEY: process.env.DOKU_SHARED_KEY,
  SECRET_KEY: process.env.DOKU_SECRET_KEY,
  API_URL: process.env.DOKU_API_URL || 'https://api-sandbox.doku.com',
  ENVIRONMENT: process.env.DOKU_ENVIRONMENT || 'sandbox'
};
```

**Payment Methods Supported**:
- Bank Transfer (VA)
- Credit Card
- E-wallet (OVO, Dana, LinkAja, etc.)
- QRIS
- Convenience Store (Alfamart, Indomaret)

**Key Functions**:

1. **Generate Signature**

```javascript
function generateDOKUSignature(data) {
  const timestamp = new Date().toISOString();
  const stringToSign = `${timestamp}:${DOKU_CONFIG.SHARED_KEY}`;

  const signature = crypto
    .createHmac('sha256', DOKU_CONFIG.SHARED_KEY)
    .update(stringToSign)
    .digest('hex');

  return { signature, timestamp };
}
```

2. **Validate Webhook Signature**

```javascript
function validateDOKUWebhook(signature, payload) {
  const calculatedSignature = crypto
    .createHmac('sha256', DOKU_CONFIG.SHARED_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === calculatedSignature;
}
```

3. **Create Payment Request**

```javascript
async function createDOKUPayment(bookingData) {
  const { signature, timestamp } = generateDOKUSignature({
    orderId: bookingData.orderId,
    amount: bookingData.amount
  });

  const response = await axios.post(
    `${DOKU_CONFIG.API_URL}/payment/v1/payment`,
    {
      order: {
        amount: bookingData.amount,
        invoice_number: bookingData.orderId
      },
      payment: {
        payment_due_date: bookingData.expirationTime
      },
      customer: {
        name: bookingData.contactName,
        email: bookingData.contactEmail
      }
    },
    {
      headers: {
        'X-TIMESTAMP': timestamp,
        'X-SIGNATURE': signature,
        'CLIENT-ID': DOKU_CONFIG.MERCHANT_ID
      }
    }
  );

  return response.data;
}
```

**Environment Variables Required**:

```env
DOKU_MERCHANT_ID=your_merchant_id
DOKU_SHARED_KEY=your_shared_key
DOKU_SECRET_KEY=your_secret_key
DOKU_API_URL=https://api-sandbox.doku.com
DOKU_ENVIRONMENT=sandbox
```

**Usage**:

```javascript
const { createDOKUPayment, validateDOKUWebhook } = require('./config/doku');

// Create payment
const payment = await createDOKUPayment({
  orderId: 'GG-OW-12345',
  amount: 500000,
  contactName: 'John Doe',
  contactEmail: 'john@example.com',
  expirationTime: '2026-04-10T12:00:00Z'
});

// Validate webhook
const isValid = validateDOKUWebhook(req.headers['x-signature'], req.body);
```

---

## WebSocket Configuration

### config/websocket.js

**Purpose**: Setup WebSocket server untuk real-time updates.

**Features**:
- Real-time seat availability updates
- Booking status notifications
- Connection management
- Broadcast to all clients

**Configuration**:

```javascript
const { WebSocketServer } = require('ws');

let wss; // WebSocket server instance
```

**Key Functions**:

1. **Initialize WebSocket Server**

```javascript
function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    ws.on('message', (message) => {
      console.log('Received:', message);
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  console.log('WebSocket server initialized');
}
```

2. **Broadcast to All Clients**

```javascript
function broadcast(data) {
  if (!wss) {
    console.error('WebSocket server belum diinisialisasi.');
    return;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
```

3. **Send to Specific Client** (if tracking clients)

```javascript
function sendToClient(clientId, data) {
  wss.clients.forEach((client) => {
    if (client.id === clientId && client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
```

**Usage in app.js**:

```javascript
const http = require('http');
const { initWebSocketServer } = require('./config/websocket');

const app = express();
const server = http.createServer(app);

initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Broadcasting Updates**:

```javascript
const { broadcast } = require('./config/websocket');

// Broadcast seat availability update
broadcast({
  type: 'seat_update',
  scheduleId: 1,
  date: '2026-04-10',
  availableSeats: 25
});

// Broadcast booking status
broadcast({
  type: 'booking_update',
  bookingId: 123,
  status: 'paid'
});
```

**Client-Side Connection**:

```javascript
const ws = new WebSocket('ws://localhost:8000');

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'seat_update') {
    updateSeatAvailability(data);
  } else if (data.type === 'booking_update') {
    updateBookingStatus(data);
  }
};

ws.onclose = () => {
  console.log('Disconnected from WebSocket');
};
```

**WebSocket Message Types**:

| Type | Description | Payload |
|------|-------------|---------|
| `seat_update` | Seat availability changed | scheduleId, date, availableSeats |
| `booking_update` | Booking status changed | bookingId, status |
| `schedule_update` | Schedule information changed | scheduleId, changes |
| `price_update` | Price changed | scheduleId, newPrice |
| `alert` | System alert | message, severity |

---

## Additional Configuration Considerations

### Environment Configuration (.env)

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=8000

# Database (Development)
DEV_DB_NAME=giligetaway_dev
DEV_DB_USER=root
DEV_DB_PASSWORD=password
DEV_DB_HOST=localhost
DEV_DB_PORT=3306
DEV_DB_DIALECT=mysql

# Database (Production)
DB_NAME=giligetaway_prod
DB_USER=prod_user
DB_PASSWORD=prod_password
DB_HOST=prod_host
DB_PORT=3306
DB_DIALECT=mysql

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_ORIGIN_1=http://localhost:3000
CORS_ORIGIN_2=https://giligetaway.com
CORS_ORIGIN_3=https://api.giligetaway.com
CORS_ORIGIN_4=https://staging.giligetaway.com

# Payment - Midtrans
MIDTRANS_SERVER_KEY=your_server_key
MIDTRANS_CLIENT_KEY=your_client_key
MIDTRANS_API_BASE_URL=https://api.midtrans.com/v2

# Payment - DOKU
DOKU_MERCHANT_ID=your_merchant_id
DOKU_SHARED_KEY=your_shared_key
DOKU_SECRET_KEY=your_secret_key
DOKU_API_URL=https://api-sandbox.doku.com
DOKU_ENVIRONMENT=sandbox

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
RESEND_API_KEY=your_resend_api_key

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# ImageKit
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=your_url_endpoint

# Google Analytics
GA4_MEASUREMENT_ID=your_measurement_id

# Cron Jobs
CRON_FREQUENCY=*/5 * * * *
CRON_FREQUENCY_SETTLEMENT=*/3 * * * *
EXPIRED_STATUS=expired
EXPIRED_EMAIL_DELAY=10800000  # 3 hours in milliseconds
```

### Config File Organization

For larger applications, consider creating additional config files:

```
config/
├── database.js
├── doku.js
├── websocket.js
├── midtrans.js      # Additional: Midtrans config
├── email.js         # Additional: Email config
├── jwt.js           # Additional: JWT config
├── imagekit.js      # Additional: ImageKit config
├── index.js         # Export all configs
└── env.js           # Centralized env loading
```

**config/index.js**:

```javascript
const database = require('./database');
const doku = require('./doku');
const websocket = require('./websocket');

module.exports = {
  database,
  doku,
  websocket
};
```

---

## Related Documentation

- [app-js.md](app-js.md) - Configuration usage in main app
- [models.md](models.md) - Database models
- [utils.md](utils.md) - Utility functions using configs
