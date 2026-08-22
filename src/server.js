// src/server.js — application assembly (Task 63 skeleton)
const express = require('express');
const crypto = require('crypto');
const config = require('./config');
const { errorHandler, notFound } = require('./middleware/error');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth.routes');
const employeeRouter = require('./routes/employee.routes');
const tripRouter = require('./routes/trip.routes');
const walletRouter = require('./routes/wallet.routes');
const attendanceRouter = require('./routes/attendance.routes');
const complaintRouter = require('./routes/complaint.routes');

const app = express();

// Request correlation ID (NFR-013)
app.use((req, _res, next) => {
  req.id = crypto.randomBytes(8).toString('hex');
  next();
});

app.use(express.json());

// Routes (no business logic in route handlers — Task 47)
app.use(healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/employees', employeeRouter);
app.use('/api/v1/trips', tripRouter);
app.use('/api/v1/wallets', walletRouter);
app.use(attendanceRouter); // /api/v1/trips/:id/attendance
app.use('/api/v1/complaints', complaintRouter);

app.use(notFound);
app.use(errorHandler);

function start() {
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on :${config.port} (${config.env})`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { app, start };
