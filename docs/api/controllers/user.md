# userController.js

## Overview

Controller ini menangani operasi CRUD untuk **User** (admin user accounts) dan fitur autentikasi termasuk login, forgot password, dan password reset. User ini adalah admin/staff yang mengelola sistem, bukan customer.

## File Location

```
controllers/userController.js
```

## Dependencies

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const nodemailer = require('nodemailer');
```

---

## Functions

### `createUser`

**Purpose**: Membuat user baru (admin account).

**Method**: `POST`

**Route**: `/api/users/register` atau `/api/users`

**Authentication Required**: Yes (Admin only - typically)

**Request Body**:
```javascript
{
  "name": "Admin User",
  "email": "admin@giligetaway.com",
  "password": "SecurePassword123",
  "role": "admin"
}
```

**Request Body Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | STRING | Yes | Nama user |
| `email` | STRING | Yes | Email user (harus unique) |
| `password` | STRING | Yes | Password user (akan di-hash) |
| `role` | STRING | No | Role user (default: 'admin') |

**Response (Success - 201)**:
```javascript
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@giligetaway.com",
    "role": "admin",
    "password": "$2a$10$hashedPassword...",
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  }
}
```

**Response (Error - 400)**:
```javascript
{
  "message": "Error creating user",
  "error": "Email already exists"
}
```

**Implementation**:
```javascript
const createUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    console.log("Received data:", { name, email, password, role });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role });
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        res.status(400).json({ message: 'Error creating user', error });
    }
};
```

**Notes**:
- Password di-hash menggunakan bcrypt dengan salt rounds 10
- Console logging digunakan untuk debugging
- Role default bisa di-set di model

---

### `loginUser`

**Purpose**: Melakukan autentikasi user dan mengembalikan JWT token.

**Method**: `POST`

**Route**: `/api/users/login`

**Authentication Required**: No

**Features**:
- **Token Caching**: Token yang valid akan di-cache di server untuk mengurangi load
- Cache berlaku selama token masih valid (24 jam)
- Password selalu diverifikasi untuk keamanan

**Request Body**:
```javascript
{
  "email": "admin@giligetaway.com",
  "password": "SecurePassword123"
}
```

**Response (Success - 200, New Token)**:
```javascript
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@giligetaway.com",
    "role": "admin"
  },
  "fromCache": false
}
```

**Response (Success - 200, Cached Token)**:
```javascript
{
  "message": "Login successful (cached token)",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@giligetaway.com",
    "role": "admin"
  },
  "fromCache": true
}
```

**Response (Error - 401)**:
```javascript
{
  "message": "Invalid email or password"
}
```

**Implementation**:
```javascript
const tokenCache = new Map();

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if token exists in cache and is still valid
        const cachedTokenData = tokenCache.get(email);
        if (cachedTokenData) {
            try {
                const decoded = jwt.verify(cachedTokenData.token, process.env.JWT_SECRET);
                const currentTime = Math.floor(Date.now() / 1000);

                if (decoded.exp > currentTime) {
                    // Verify password first for security
                    const user = await User.findOne({ where: { email } });
                    if (!user || !(await bcrypt.compare(password, user.password))) {
                        return res.status(401).json({ message: 'Invalid email or password' });
                    }

                    return res.status(200).json({
                        message: 'Login successful (cached token)',
                        token: cachedTokenData.token,
                        user: { id: user.id, name: user.name, email: user.email, role: user.role },
                        fromCache: true
                    });
                } else {
                    tokenCache.delete(email);
                }
            } catch (err) {
                tokenCache.delete(email);
            }
        }

        // Normal login flow
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

        // Save new token in cache
        tokenCache.set(email, { token, createdAt: Date.now() });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            fromCache: false
        });
    } catch (error) {
        console.error('Error during login process:', error.message);
        res.status(400).json({ message: 'Login error', error });
    }
};
```

**Token Caching Logic**:
1. Cek cache untuk token yang ada
2. Jika ada, verifikasi token masih valid (tidak expired)
3. Jika valid, verifikasi password (security measure)
4. Jika invalid/tidak ada, generate token baru
5. Simpan token baru di cache

**Important Notes**:
- Token berlaku selama 24 jam
- Password selalu diverifikasi meskipun token di-cache
- Cache disimpan di memory (akan hilang jika server restart)
- Untuk production, pertimbangkan menggunakan Redis untuk cache distribusi

---

### `changePassword`

**Purpose**: Mengubah password user yang sedang login.

**Method**: `POST`

**Route**: `/api/users/change-password`

**Authentication Required**: Yes

**Request Body**:
```javascript
{
  "email": "admin@giligetaway.com",
  "oldPassword": "SecurePassword123",
  "newPassword": "NewSecurePassword456"
}
```

**Request Body Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | STRING | Yes | Email user |
| `oldPassword` | STRING | Yes | Password lama |
| `newPassword` | STRING | Yes | Password baru |

**Response (Success - 200)**:
```javascript
{
  "message": "Password changed successfully"
}
```

**Response (Error - 401)**:
```javascript
{
  "message": "Incorrect email or old password"
}
```

**Response (Error - 400)**:
```javascript
{
  "message": "New password cannot be the same as the old password"
}
```

**Implementation**:
```javascript
const changePassword = async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
            return res.status(401).json({ message: 'Incorrect email or old password' });
        }

        if (await bcrypt.compare(newPassword, user.password)) {
            return res.status(400).json({ message: 'New password cannot be the same as the old password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Error changing password', error });
    }
};
```

**Validation**:
- Email dan old password harus benar
- Password baru tidak boleh sama dengan password lama

---

### `forgotPassword`

**Purpose**: Mengirim email reset password ke user.

**Method**: `POST`

**Route**: `/api/users/forgot-password`

**Authentication Required**: No

**Environment Variables Required**:
```env
FRONTEND_URL=https://your-frontend-url.com
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password
```

**Request Body**:
```javascript
{
  "email": "admin@giligetaway.com"
}
```

**Response (Success - 200)**:
```javascript
{
  "message": "Reset password link sent to email",
  "resetUrl": "https://your-frontend-url.com/reset-password?token=eyJhbGci..."
}
```

**Response (Not Found - 404)**:
```javascript
{
  "message": "User not found"
}
```

**Response (Error - 500)**:
```javascript
{
  "message": "Internal server error",
  "error": "Error message"
}
```

**Email Template**:
```
Hello {User Name},

We received a request to reset your password. Click the link below to reset it:
{Reset URL}

If you did not request this, please ignore this email.

Thanks,
The Gili Getaway Team
```

**Implementation**:
```javascript
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate token
        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Create reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        // Send email
        const transporter = nodemailer.createTransport({
            host: 'mail.headlessexploregilis.my.id',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Reset Password Gili Getaway',
            html: `<p>Hello ${user.name},</p>...`
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Reset password link sent to email', resetUrl });
    } catch (error) {
        console.error('Error in forgotPassword:', error.message);
        res.status(500).json({ message: 'Internal server error', error });
    }
};
```

**Important Notes**:
- Reset token berlaku selama 1 jam
- Email dikirim menggunakan Nodemailer via SMTP
- SMTP host dikonfigurasi untuk specific domain
- Token tidak disimpan di database (JWT stateless)

---

### `resetPasswordWithToken`

**Purpose**: Reset password menggunakan token dari forgot password.

**Method**: `POST`

**Route**: `/api/users/reset-password`

**Authentication Required**: No

**Request Body**:
```javascript
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewSecurePassword456"
}
```

**Response (Success - 200)**:
```javascript
{
  "message": "Password reset successfully"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "message": "User not found"
}
```

**Response (Error - 400)**:
```javascript
{
  "message": "Token has expired"
}
```

**Response (Error - 500)**:
```javascript
{
  "message": "Internal server error",
  "error": "Error message"
}
```

**Implementation**:
```javascript
const resetPasswordWithToken = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user
        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Token has expired' });
        }
        res.status(500).json({ message: 'Internal server error', error });
    }
};
```

---

### `getUsers`

**Purpose**: Mendapatkan semua user.

**Method**: `GET`

**Route**: `/api/users`

**Authentication Required**: Yes (Admin only)

**Response (Success - 200)**:
```javascript
[
  {
    "id": 1,
    "name": "Admin User",
    "email": "admin@giligetaway.com",
    "role": "admin",
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Staff User",
    "email": "staff@giligetaway.com",
    "role": "staff",
    "created_at": "2026-04-06T00:00:00.000Z",
    "updated_at": "2026-04-06T00:00:00.000Z"
  }
]
```

**Response (Error - 400)**:
```javascript
{
  "message": "Error fetching users",
  "error": "Error message"
}
```

**Implementation**:
```javascript
const getUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        res.status(400).json({ message: 'Error fetching users', error });
    }
};
```

---

### `getUserById`

**Purpose**: Mendapatkan user berdasarkan ID.

**Method**: `GET`

**Route**: `/api/users/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - User ID (integer)

**Response (Success - 200)**:
```javascript
{
  "id": 1,
  "name": "Admin User",
  "email": "admin@giligetaway.com",
  "role": "admin",
  "created_at": "2026-04-06T00:00:00.000Z",
  "updated_at": "2026-04-06T00:00:00.000Z"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "message": "User not found"
}
```

**Response (Error - 400)**:
```javascript
{
  "message": "Error fetching user",
  "error": "Error message"
}
```

**Implementation**:
```javascript
const getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: 'Error fetching user', error });
    }
};
```

---

### `updateUser`

**Purpose**: Mengupdate data user.

**Method**: `PUT`

**Route**: `/api/users/:id`

**Authentication Required**: Yes (Admin only)

**URL Parameters**:
- `id` - User ID (integer)

**Request Body** (semua field optional):
```javascript
{
  "name": "Updated Admin Name",
  "email": "updated-admin@giligetaway.com",
  "role": "superadmin"
}
```

**Response (Success - 200)**:
```javascript
{
  "message": "User updated successfully",
  "user": {
    "id": 1,
    "name": "Updated Admin Name",
    "email": "updated-admin@giligetaway.com",
    "role": "superadmin",
    "updatedAt": "2026-04-06T01:30:00.000Z"
  }
}
```

**Response (Not Found - 404)**:
```javascript
{
  "message": "User not found",
  "details": "No user found with the ID: 999"
}
```

**Response (Error - 500)**:
```javascript
{
  "message": "Error updating user",
  "error": "Error message",
  "details": "An unexpected error occurred while updating the user. Please try again later."
}
```

**Implementation**:
```javascript
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body;

    try {
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                details: `No user found with the ID: ${id}`,
            });
        }

        // Update fields if provided
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;

        await user.save();

        return res.status(200).json({
            message: "User updated successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error updating user",
            error: error.message,
            details: "An unexpected error occurred while updating the user. Please try again later.",
        });
    }
};
```

**Notes**:
- Hanya field yang dikirim akan diupdate
- Password tidak bisa diupdate melalui endpoint ini (gunakan changePassword)
- `updatedAt` akan otomatis diupdate

---

### `deleteUser`

**Purpose**: Menghapus user secara permanen.

**Method**: `DELETE`

**Route**: `/api/users/:id`

**Authentication Required**: Yes (Admin only, superadmin only recommended)

**URL Parameters**:
- `id` - User ID (integer)

**Response (Success - 200)**:
```javascript
{
  "message": "User deleted successfully"
}
```

**Response (Not Found - 404)**:
```javascript
{
  "message": "User not found"
}
```

**Response (Error - 400)**:
```javascript
{
  "message": "Error deleting user",
  "error": "Error message"
}
```

**Implementation**:
```javascript
const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await user.destroy();
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Error deleting user', error });
    }
};
```

**Important Notes**:
- **CAUTION**: Ini adalah hard delete (permanent deletion)
- Pertimbangkan soft delete untuk production
- Jangan hapus user yang masih memiliki active sessions
- Superadmin sebaiknya tidak bisa dihapus

---

## Model Reference

### User Model

```javascript
{
  id: INTEGER (Primary Key, Auto Increment),
  name: STRING (Not Null),
  email: STRING (Not Null, Unique),
  password: STRING (Not Null) - Hashed with bcrypt,
  role: STRING (Not Null),
  created_at: DATE,
  updated_at: DATE
}
```

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | Standard admin | Full access to admin panel |
| `superadmin` | Super admin | Full access + user management |

---

## Authentication Flow

### Login Flow with Token Caching

```
1. User submits email and password
2. Server checks cache for existing token
3. If valid token exists:
   a. Verify password (security)
   b. Return cached token
4. If no token or expired:
   a. Verify credentials
   b. Generate new JWT token
   c. Store in cache
   d. Return new token
```

### Password Reset Flow

```
1. User requests password reset with email
2. Server generates JWT token (1 hour expiry)
3. Server sends email with reset link
4. User clicks link (opens frontend with token)
5. Frontend sends token + new password to server
6. Server verifies token
7. Server updates password
8. User can login with new password
```

---

## Usage Examples

### Creating a New User

```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Admin User",
    "email": "admin@giligetaway.com",
    "password": "SecurePassword123",
    "role": "admin"
  }'
```

### Login

```bash
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@giligetaway.com",
    "password": "SecurePassword123"
  }'
```

### Changing Password

```bash
curl -X POST http://localhost:8000/api/users/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "email": "admin@giligetaway.com",
    "oldPassword": "SecurePassword123",
    "newPassword": "NewSecurePassword456"
  }'
```

### Forgot Password

```bash
curl -X POST http://localhost:8000/api/users/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@giligetaway.com"
  }'
```

### Reset Password with Token

```bash
curl -X POST http://localhost:8000/api/users/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "newPassword": "NewSecurePassword456"
  }'
```

### Getting All Users

```bash
curl http://localhost:8000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Updating a User

```bash
curl -X PUT http://localhost:8000/api/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Updated Admin Name",
    "role": "superadmin"
  }'
```

### Deleting a User

```bash
curl -X DELETE http://localhost:8000/api/users/2 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Handling

| Error Type | Status Code | Message |
|------------|-------------|---------|
| Invalid Credentials | 401 | "Invalid email or password" |
| User Not Found | 404 | "User not found" |
| Token Expired | 400 | "Token has expired" |
| Password Same as Old | 400 | "New password cannot be the same as the old password" |
| Validation Error | 400 | Sequelize validation error message |
| Database Error | 500 | Internal server error |

---

## Security Considerations

### Password Security
- Passwords di-hash menggunakan bcrypt dengan 10 salt rounds
- Password tidak pernah dikirim dalam response (kecuali error message)
- Password selalu diverifikasi meskipun menggunakan cached token

### Token Security
- JWT token digunakan untuk stateless authentication
- Token berisi user ID dan role
- Token expiry: 24 jam untuk login, 1 jam untuk password reset
- Token disimpan di cache untuk performance (bukan security)

### Email Security
- Reset token dikirim via email
- Token tidak disimpan di database (JWT stateless)
- Email configuration menggunakan SMTP dengan TLS

### Recommendations for Production
1. **Use Redis** for token cache instead of in-memory Map
2. **Implement rate limiting** for login attempts
3. **Add password complexity validation**
4. **Use soft delete** instead of hard delete
5. **Log authentication events** for audit trail
6. **Implement 2FA** for admin accounts

---

## Related Routes

```javascript
// routes/user.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');

router.post('/register', authenticate, userController.createUser);
router.post('/login', userController.loginUser);
router.post('/change-password', authenticate, userController.changePassword);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPasswordWithToken);
router.get('/', authenticate, userController.getUsers);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);
router.delete('/:id', authenticate, userController.deleteUser);

module.exports = router;
```

---

## Related Documentation

- [Model: User](../../database/models.md#user)
- [Route: User](routes.md#users-api-users)
- [Middleware: authenticate](middleware.md#authenticatejs)
- [JWT Token](https://jwt.io/)

---

**Last Updated**: 2026-04-06
