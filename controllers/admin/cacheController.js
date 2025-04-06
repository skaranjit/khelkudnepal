const redisClient = require('../../utils/redisClient');
const leagueCache = require('../../utils/leagueCache');
const newsCache = require('../../utils/newsCache');
const userCache = require('../../utils/userCache');
const matchCache = require('../../utils/matchCache');
const League = require('../../models/League');
const News = require('../../models/News');
const User = require('../../models/User');
const Match = require('../../models/Match');
const newsController = require('../newsController');
const logger = require('../../utils/logger');

/**
 * Clear all Redis cache
 */
exports.clearAllCache = async (req, res) => {
  try {
    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Flush Redis cache
    await redisClient.flushAll();

    return res.status(200).json({
      success: true,
      message: 'All cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing cache: ' + error.message
    });
  }
};

/**
 * Clear news cache only
 */
exports.clearNewsCache = async (req, res) => {
  try {
    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild news cache (which first clears existing cache)
    await newsCache.rebuildCache();

    return res.status(200).json({
      success: true,
      message: 'News cache cleared and rebuilt successfully'
    });
  } catch (error) {
    console.error('Error clearing news cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing news cache: ' + error.message
    });
  }
};

/**
 * Clear leagues cache only
 */
exports.clearLeaguesCache = async (req, res) => {
  try {
    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild leagues cache (which first clears existing cache)
    await leagueCache.rebuildCache();

    return res.status(200).json({
      success: true,
      message: 'Leagues cache cleared and rebuilt successfully'
    });
  } catch (error) {
    console.error('Error clearing leagues cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing leagues cache: ' + error.message
    });
  }
};

/**
 * Clear users cache only
 */
exports.clearUsersCache = async (req, res) => {
  try {
    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild users cache (which first clears existing cache)
    await userCache.rebuildCache();

    return res.status(200).json({
      success: true,
      message: 'Users cache cleared and rebuilt successfully'
    });
  } catch (error) {
    console.error('Error clearing users cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing users cache: ' + error.message
    });
  }
};

/**
 * Clear matches cache only
 */
exports.clearMatchesCache = async (req, res) => {
  try {
    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild matches cache (which first clears existing cache)
    await matchCache.rebuildCache();

    return res.status(200).json({
      success: true,
      message: 'Matches cache cleared and rebuilt successfully'
    });
  } catch (error) {
    console.error('Error clearing matches cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing matches cache: ' + error.message
    });
  }
};

/**
 * Clear database
 */
exports.clearDatabase = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const { target } = req.body;
    
    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'Target collection is required'
      });
    }

    let message = '';

    switch (target) {
      case 'news':
        await News.deleteMany({});
        message = 'All news articles deleted successfully';
        // Clear related cache
        if (redisClient.isEnabled() && redisClient.isConnected()) {
          await newsCache.rebuildCache();
        }
        break;
      
      case 'leagues':
        await League.deleteMany({});
        message = 'All leagues deleted successfully';
        // Clear related cache
        if (redisClient.isEnabled() && redisClient.isConnected()) {
          await leagueCache.rebuildCache();
        }
        break;
      
      case 'all':
        // This is dangerous! Consider adding more safeguards
        await News.deleteMany({});
        await League.deleteMany({});
        message = 'All database content deleted successfully';
        
        // Clear all cache
        if (redisClient.isEnabled() && redisClient.isConnected()) {
          await redisClient.flushAll();
        }
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid target collection'
        });
    }

    return res.status(200).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing database: ' + error.message
    });
  }
};

/**
 * Get cache status
 */
exports.getCacheStatus = async (req, res) => {
  try {
    const isRedisEnabled = redisClient.isEnabled();
    const isRedisConnected = redisClient.isConnected();

    // Get cache keys count if Redis is available
    let cacheInfo = null;
    if (isRedisEnabled && isRedisConnected) {
      const newsKeys = await redisClient.client.keys('news:*');
      const leagueKeys = await redisClient.client.keys('leagues:*');
      const userKeys = await redisClient.client.keys('user:*');
      const matchKeys = await redisClient.client.keys('matches:*');
      
      cacheInfo = {
        newsKeysCount: newsKeys.length,
        leagueKeysCount: leagueKeys.length,
        userKeysCount: userKeys.length,
        matchKeysCount: matchKeys.length,
        totalKeysCount: newsKeys.length + leagueKeys.length + userKeys.length + matchKeys.length
      };
    }

    // Get database counts
    const newsCount = await News.countDocuments();
    const leaguesCount = await League.countDocuments();
    const usersCount = await User.countDocuments();
    const matchesCount = await Match.countDocuments();
    
    // Get match counts by status
    const liveMatches = await Match.countDocuments({ status: 'live' });
    const upcomingMatches = await Match.countDocuments({ 
      status: 'scheduled',
      startTime: { $gt: new Date() } 
    });
    const completedMatches = await Match.countDocuments({ status: 'completed' });
    
    // Get match counts by category
    const sportCategories = ['cricket', 'football', 'basketball', 'volleyball', 'othersports'];
    const matchCategoryCounts = {};
    
    for (const category of sportCategories) {
      const regex = new RegExp(`^${category}$`, 'i');
      matchCategoryCounts[category] = await Match.countDocuments({ category: regex });
    }
    
    // Get articles by category
    const categories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other_sports'];
    const categoryCounts = {};
    
    for (const category of categories) {
      // Use case-insensitive regex to match both capitalized and lowercase categories
      const regex = new RegExp(`^${category}$`, 'i');
      categoryCounts[category] = await News.countDocuments({ category: regex });
    }
    
    // Get leagues by category with standings information
    const leagueCategories = ['Cricket', 'Football', 'Basketball', 'Volleyball', 'Other'];
    const leagueCategoryCounts = {};
    const leagueStandings = {};
    
    for (const category of leagueCategories) {
      // Count leagues by category using case-insensitive matching
      const regex = new RegExp(`^${category}$`, 'i');
      leagueCategoryCounts[category] = await League.countDocuments({ category: regex });
      
      // Get leagues with teams data for this category
      const leaguesInCategory = await League.find({ category: regex })
        .select('name teams')
        .lean();
      
      // Process each league to get proper standings data
      leagueStandings[category] = leaguesInCategory.map(league => {
        // Sort teams by points (highest first)
        const teams = league.teams || [];
        const sortedTeams = [...teams].sort((a, b) => {
          // First by points
          if (a.points !== b.points) return b.points - a.points;
          
          // Then by goal difference
          const aGoalDiff = a.goalsFor - a.goalsAgainst;
          const bGoalDiff = b.goalsFor - b.goalsAgainst;
          if (aGoalDiff !== bGoalDiff) return bGoalDiff - aGoalDiff;
          
          // Then by goals scored
          return b.goalsFor - a.goalsFor;
        });
        
        // Convert to a more standard format for the frontend
        const formattedTeams = sortedTeams.map(team => ({
          team: team.name,
          logo: team.logo,
          played: team.played || 0,
          won: team.won || 0,
          drawn: team.drawn || 0,
          lost: team.lost || 0,
          goalsFor: team.goalsFor || 0,
          goalsAgainst: team.goalsAgainst || 0,
          points: team.points || 0
        }));
        
        return {
          name: league.name,
          id: league._id.toString(),
          teamsCount: teams.length,
          hasStandings: teams.length > 0,
          standings: formattedTeams
        };
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        redis: {
          enabled: isRedisEnabled,
          connected: isRedisConnected,
          cacheInfo
        },
        database: {
          newsCount,
          leaguesCount,
          usersCount,
          matchesCount,
          newsByCategory: categoryCounts,
          leaguesByCategory: leagueCategoryCounts,
          leagueStandings,
          matchesByStatus: {
            live: liveMatches,
            upcoming: upcomingMatches,
            completed: completedMatches
          },
          matchesByCategory: matchCategoryCounts
        }
      }
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting cache status: ' + error.message
    });
  }
};

/**
 * Refresh news cache with current database data
 */
exports.refreshNewsCache = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild news cache from database
    await newsCache.rebuildCache();
    
    // Get total articles count for response
    const totalArticles = await News.countDocuments();
    
    return res.status(200).json({
      success: true,
      message: 'News cache refreshed successfully from database',
      data: {
        totalArticles
      }
    });
  } catch (error) {
    console.error('Error refreshing news cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error refreshing news cache: ' + error.message
    });
  }
};

/**
 * Refresh leagues cache with current database data
 */
exports.refreshLeaguesCache = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild leagues cache from database
    await leagueCache.rebuildCache();
    
    // Get total leagues count for response
    const totalLeagues = await League.countDocuments();
    
    // Get leagues with teams count
    const leaguesWithTeams = await League.countDocuments({
      'teams.0': { $exists: true }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Leagues cache refreshed successfully from database',
      data: {
        totalLeagues,
        leaguesWithTeams
      }
    });
  } catch (error) {
    console.error('Error refreshing leagues cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error refreshing leagues cache: ' + error.message
    });
  }
};

/**
 * Refresh matches cache with current database data
 */
exports.refreshMatchesCache = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Check if Redis is enabled and connected
    if (!redisClient.isEnabled() || !redisClient.isConnected()) {
      return res.status(400).json({
        success: false,
        message: 'Redis is not available or connected'
      });
    }

    // Rebuild matches cache from database
    await matchCache.rebuildCache();
    
    // Get total matches count for response
    const totalMatches = await Match.countDocuments();
    
    // Get matches by status for response
    const liveMatches = await Match.countDocuments({ status: 'live' });
    const upcomingMatches = await Match.countDocuments({ 
      status: 'scheduled',
      startTime: { $gt: new Date() } 
    });
    const completedMatches = await Match.countDocuments({ status: 'completed' });
    
    return res.status(200).json({
      success: true,
      message: 'Matches cache refreshed successfully from database',
      data: {
        totalMatches,
        liveMatches,
        upcomingMatches,
        completedMatches
      }
    });
  } catch (error) {
    console.error('Error refreshing matches cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error refreshing matches cache: ' + error.message
    });
  }
}; 