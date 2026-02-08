const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');

// Get all projects
const getAllProjects = async (req, res) => {
    try {
        const projects = await pool.query(`
      SELECT 
        p.*,
        u.full_name as manager_name,
        COUNT(DISTINCT ph.id) as total_phases,
        COUNT(DISTINCT w.id) as total_worklogs
      FROM projects p
      LEFT JOIN users u ON p.project_manager_id = u.id
      LEFT JOIN phases ph ON p.id = ph.project_id
      LEFT JOIN work_logs w ON p.id = w.project_id
      GROUP BY p.id, u.full_name
      ORDER BY p.created_at DESC
    `);

        return successResponse(res, 200, 'Projects retrieved successfully', { projects: projects.rows });
    } catch (err) {
        console.error('Get projects error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Get single project with phases
const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;

        const project = await pool.query(`
      SELECT p.*, u.full_name as manager_name 
      FROM projects p 
      LEFT JOIN users u ON p.project_manager_id = u.id 
      WHERE p.id = $1
    `, [id]);

        if (project.rows.length === 0) {
            return errorResponse(res, 404, 'Project not found');
        }

        const phases = await pool.query(
            'SELECT * FROM phases WHERE project_id = $1 ORDER BY phase_order',
            [id]
        );

        return successResponse(res, 200, 'Project retrieved successfully', {
            project: {
                ...project.rows[0],
                phases: phases.rows
            }
        });

    } catch (err) {
        console.error('Get project error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

const createProject = async (req, res) => {
    try {
        const { name, description, project_manager_id, status, start_date, end_date } = req.body;

        if (!name) {
            return errorResponse(res, 400, 'Project name is required');
        }

        const newProject = await pool.query(
            'INSERT INTO projects (name, description, user_id, project_manager_id, status, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, description, req.user.id, project_manager_id || null, status || 'active', start_date || null, end_date || null]
        );

        return successResponse(res, 201, 'Project created successfully', { project: newProject.rows[0] });

    } catch (err) {
        console.error('Create project error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Update project
const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, project_manager_id, status, end_date } = req.body;

        const updatedProject = await pool.query(
            'UPDATE projects SET name = $1, description = $2, project_manager_id = $3, status = $4, end_date = $5 WHERE id = $6 RETURNING *',
            [name, description, project_manager_id, status, end_date, id]
        );

        if (updatedProject.rows.length === 0) {
            return errorResponse(res, 404, 'Project not found');
        }

        return successResponse(res, 200, 'Project updated successfully', { project: updatedProject.rows[0] });

    } catch (err) {
        console.error('Update project error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Delete project
const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedProject = await pool.query(
            'DELETE FROM projects WHERE id = $1 RETURNING *',
            [id]
        );

        if (deletedProject.rows.length === 0) {
            return errorResponse(res, 404, 'Project not found');
        }

        return successResponse(res, 200, 'Project deleted successfully');

    } catch (err) {
        console.error('Delete project error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

module.exports = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject
};
