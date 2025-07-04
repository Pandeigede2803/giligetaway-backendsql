// middlewares/checkAgentExist.js
const { Agent } = require('../models'); // sesuaikan path dengan struktur Anda

/**
 * Middleware untuk memeriksa apakah agent dengan id tertentu ada di database.
 * - Dapat diambil dari req.query.agent_id atau req.params.agent_id (sesuai kebutuhan).
 * - Menggunakan Promise (then/catch) tanpa async/await.
 */
const checkAgentExist = (req, res, next) => {
  // Misalnya: ambil agentId dari query
const agentId = req.query.agent_id || req.params.agent_id || req.body.agent_id;

  // Validasi: pastikan agent_id disertakan
  if (!agentId) {
    return res.status(400).json({
      success: false,
      message: 'agent_id is required'
    });
  }

  // Cek apakah Agent dengan id tersebut ada
  Agent.findByPk(agentId)
    .then((agent) => {
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: `Agent with id ${agentId} not found`
        });
      }

      // Jika agent ditemukan, simpan ke req agar bisa dipakai di controller
      req.agent = agent;
      next();
    })
    .catch((error) => {
      console.error("Error checkAgentExist middleware:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: error.message
      });
    });
};

module.exports = checkAgentExist;
