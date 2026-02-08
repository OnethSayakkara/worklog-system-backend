const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');

// Get all phases for a project
const getPhasesByProject = async (req, res) => {
    try {
        const { project_id } = req.params;

        const phases = await pool.query(`
      SELECT 
        ph.*,
        COUNT(w.id) as total_worklogs,
        COALESCE(SUM(w.hours_spent), 0) as total_hours
      FROM phases ph
      LEFT JOIN work_logs w ON ph.id = w.phase_id
      WHERE ph.project_id = $1
      GROUP BY ph.id
      ORDER BY ph.phase_order
    `, [project_id]);

        return successResponse(res, 200, 'Phases retrieved successfully', { phases: phases.rows });

    } catch (err) {
        console.error('Get phases error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Get single phase by ID
const getPhaseById = async (req, res) => {
    try {
        const { id } = req.params;

        const phase = await pool.query(`
      SELECT 
        ph.*,
        p.name as project_name,
        COUNT(w.id) as total_worklogs,
        COALESCE(SUM(w.hours_spent), 0) as total_hours
      FROM phases ph
      LEFT JOIN projects p ON ph.project_id = p.id
      LEFT JOIN work_logs w ON ph.id = w.phase_id
      WHERE ph.id = $1
      GROUP BY ph.id, p.name
    `, [id]);

        if (phase.rows.length === 0) {
            return errorResponse(res, 404, 'Phase not found');
        }

        return successResponse(res, 200, 'Phase retrieved successfully', { phase: phase.rows[0] });

    } catch (err) {
        console.error('Get phase error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Create new phase
const createPhase = async (req, res) => {
    try {
        const { project_id, phase_name, description, status, phase_order, start_date, end_date } = req.body;

        // Validation
        if (!project_id || !phase_name || !phase_order) {
            return errorResponse(res, 400, 'Project ID, phase name, and phase order are required');
        }

        // Check if project exists
        const projectExists = await pool.query(
            'SELECT id FROM projects WHERE id = $1',
            [project_id]
        );

        if (projectExists.rows.length === 0) {
            return errorResponse(res, 404, 'Project not found');
        }

        // Check if phase_order already exists for this project
        const orderExists = await pool.query(
            'SELECT id FROM phases WHERE project_id = $1 AND phase_order = $2',
            [project_id, phase_order]
        );

        if (orderExists.rows.length > 0) {
            return errorResponse(res, 400, `Phase order ${phase_order} already exists for this project`);
        }

        // Create phase
        const newPhase = await pool.query(
            'INSERT INTO phases (project_id, phase_name, description, status, phase_order, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [
                project_id,
                phase_name,
                description || null,
                status || 'not_started',
                phase_order,
                start_date || null,
                end_date || null
            ]
        );

        return successResponse(res, 201, 'Phase created successfully', { phase: newPhase.rows[0] });

    } catch (err) {
        console.error('Create phase error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Update phase
const updatePhase = async (req, res) => {
    try {
        const { id } = req.params;
        const { phase_name, description, status, phase_order, start_date, end_date } = req.body;

        // Check if phase exists
        const phaseExists = await pool.query(
            'SELECT * FROM phases WHERE id = $1',
            [id]
        );

        if (phaseExists.rows.length === 0) {
            return errorResponse(res, 404, 'Phase not found');
        }

        // If updating phase_order, check for duplicates
        if (phase_order && phase_order !== phaseExists.rows[0].phase_order) {
            const orderExists = await pool.query(
                'SELECT id FROM phases WHERE project_id = $1 AND phase_order = $2 AND id != $3',
                [phaseExists.rows[0].project_id, phase_order, id]
            );

            if (orderExists.rows.length > 0) {
                return errorResponse(res, 400, `Phase order ${phase_order} already exists for this project`);
            }
        }

        // Update phase
        const updatedPhase = await pool.query(
            `UPDATE phases 
       SET phase_name = COALESCE($1, phase_name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           phase_order = COALESCE($4, phase_order),
           start_date = COALESCE($5, start_date),
           end_date = COALESCE($6, end_date)
       WHERE id = $7 
       RETURNING *`,
            [phase_name, description, status, phase_order, start_date, end_date, id]
        );

        return successResponse(res, 200, 'Phase updated successfully', { phase: updatedPhase.rows[0] });

    } catch (err) {
        console.error('Update phase error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Delete phase
const deletePhase = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if phase has work logs
        const hasWorklogs = await pool.query(
            'SELECT COUNT(*) as count FROM work_logs WHERE phase_id = $1',
            [id]
        );

        if (parseInt(hasWorklogs.rows[0].count) > 0) {
            return errorResponse(res, 400, 'Cannot delete phase with existing work logs. Delete work logs first.');
        }

        // Delete phase
        const deletedPhase = await pool.query(
            'DELETE FROM phases WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedPhase.rows.length === 0) {
            return errorResponse(res, 404, 'Phase not found');
        }

        return successResponse(res, 200, 'Phase deleted successfully');

    } catch (err) {
        console.error('Delete phase error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

module.exports = {
    getPhasesByProject,
    getPhaseById,
    createPhase,
    updatePhase,
    deletePhase
};
