const Match = require('../models/Match');
const mongoose = require('mongoose');

// Get all matches with optional filtering
exports.getAllMatches = async (req, res) => {
    try {
        const { category, status } = req.query;
        const query = {};

        if (category) query.category = category;
        if (status) query.status = status;

        const matches = await Match.find(query)
            .sort({ startTime: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            count: matches.length,
            data: matches
        });
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Get matches by category
exports.getMatchesByCategory = async (req, res) => {
    try {
        const matches = await Match.find({ category: req.params.category })
            .sort({ startTime: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            count: matches.length,
            data: matches
        });
    } catch (error) {
        console.error('Error fetching category matches:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Get live matches
exports.getLiveMatches = async (req, res) => {
    try {
        const { category } = req.query;
        const query = { status: 'live' };
        
        // Add category filter if provided
        if (category) {
            query.category = category;
        }
        
        console.log('Live matches query:', query);
        
        const matches = await Match.find(query)
            .sort({ startTime: -1 });

        res.status(200).json({
            success: true,
            count: matches.length,
            data: matches
        });
    } catch (error) {
        console.error('Error fetching live matches:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Get upcoming matches
exports.getUpcomingMatches = async (req, res) => {
    try {
        const { category, limit = 20 } = req.query;
        const query = { 
            status: 'scheduled',
            startTime: { $gt: new Date() }
        };
        
        // Add category filter if provided
        if (category) {
            query.category = category;
        }
        
        console.log('Upcoming matches query:', query);
        
        const matches = await Match.find(query)
        .sort({ startTime: 1 })
        .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: matches.length,
            data: matches
        });
    } catch (error) {
        console.error('Error fetching upcoming matches:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Get completed matches
exports.getCompletedMatches = async (req, res) => {
    try {
        const { category, limit = 20 } = req.query;
        const query = { status: 'completed' };
        
        // Add category filter if provided
        if (category) {
            query.category = category;
        }
        
        console.log('Completed matches query:', query);
        
        const matches = await Match.find(query)
            .sort({ startTime: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: matches.length,
            data: matches
        });
    } catch (error) {
        console.error('Error fetching completed matches:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Get match by ID
exports.getMatchById = async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        // For cricket matches, calculate target runs and remaining overs
        if (match.category === 'Cricket' && match.status === 'live' && match.innings && match.innings.length > 1) {
            const firstInnings = match.innings[0];
            const secondInnings = match.innings[1];
            
            // Calculate target runs
            match.targetRuns = firstInnings.runs + 1;
            
            // Calculate remaining runs
            match.remainingRuns = match.targetRuns - secondInnings.runs;
            
            // Calculate remaining overs
            const maxOvers = 50; // Assuming ODI format
            const completedOvers = secondInnings.overs;
            const completedFullOvers = Math.floor(completedOvers);
            const partialOverBalls = (completedOvers - completedFullOvers) * 6;
            
            const totalRemainingBalls = (maxOvers - completedFullOvers) * 6 - partialOverBalls;
            const remainingFullOvers = Math.floor(totalRemainingBalls / 6);
            const remainingBalls = totalRemainingBalls % 6;
            
            match.remainingOvers = remainingFullOvers + (remainingBalls / 10); // Format as 14.3 for 14 overs and 3 balls
        }
        
        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error fetching match:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Create a new match (admin only)
exports.createMatch = async (req, res) => {
    try {
        const match = await Match.create(req.body);

        res.status(201).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error creating match:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Update a match (admin only)
exports.updateMatch = async (req, res) => {
    try {
        const match = await Match.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error updating match:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Update match score (admin only)
exports.updateScore = async (req, res) => {
    try {
        const { homeScore, awayScore } = req.body;
        
        // Make sure scores are provided
        if (homeScore === undefined || awayScore === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Please provide both home and away scores'
            });
        }

        const match = await Match.findByIdAndUpdate(
            req.params.id,
            { homeScore, awayScore },
            { new: true }
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error updating score:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Update match status (admin only)
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a status'
            });
        }

        // Check if status is valid
        const validStatuses = ['scheduled', 'live', 'completed', 'postponed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status value'
            });
        }

        const match = await Match.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error updating status:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Add commentary to a match (admin only)
exports.addCommentary = async (req, res) => {
    try {
        const { text, important } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'Please provide commentary text'
            });
        }

        const match = await Match.findById(req.params.id);

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        // Add commentary
        match.commentary.push({
            time: new Date(),
            text,
            important: important || false
        });

        await match.save();

        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error adding commentary:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Delete a match (admin only)
exports.deleteMatch = async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        await match.remove();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error('Error deleting match:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Add update to a match
exports.addUpdate = async (req, res) => {
    try {
        const { text, important } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'Please provide update text'
            });
        }

        const match = await Match.findById(req.params.id);

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        // Add update
        match.updates.push({
            time: new Date(),
            text,
            important: important || false
        });

        await match.save();

        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error adding update:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Remove update from a match
exports.removeUpdate = async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        // Find the update index by ID
        const updateIndex = match.updates.findIndex(
            update => update._id.toString() === req.params.updateId
        );

        if (updateIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Update not found'
            });
        }

        // Remove the update
        match.updates.splice(updateIndex, 1);
        await match.save();

        res.status(200).json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error removing update:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
}; 