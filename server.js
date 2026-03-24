/**
 * Walkability Expert Evaluation Tool - Local Server
 * Usage: Double-click start.bat or run: node server.js
 * URL: http://localhost:3000
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;

var PORT = 3000;
var ROOT_DIR = __dirname;

// MIME types
var MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Data directory
var DATA_DIR = path.join(ROOT_DIR, 'data');
var CONFIG_FILE = path.join(DATA_DIR, 'user-config.json');
var RATINGS_FILE = path.join(DATA_DIR, 'user-ratings.json');
var IMAGES_DIR = path.join(ROOT_DIR, 'images');

// Documentation files (in docs directory)
var DOCS_DIR = path.join(ROOT_DIR, 'docs');
var RATING_STANDARDS_FILE = path.join(DOCS_DIR, '可步行性评价评分标准.md');
var KNOWLEDGE_GRAPH_FILE = path.join(DOCS_DIR, '可步行性评价知识图谱.md');

console.log('[DEBUG] Rating standards file:', RATING_STANDARDS_FILE);
console.log('[DEBUG] Knowledge graph file:', KNOWLEDGE_GRAPH_FILE);

// Supported image formats
var IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Read JSON file
function readJSONFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      var content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[ERROR] Failed to read file:', filePath, err.message);
  }
  return defaultValue !== undefined ? defaultValue : null;
}

// Write JSON file
function writeJSONFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[ERROR] Failed to write file:', filePath, err.message);
    return false;
  }
}

// Send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Read request body
function readRequestBody(req, callback) {
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });
  req.on('end', function() {
    callback(body);
  });
}

// Handle API requests
function handleAPI(req, res, pathname, method) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight request
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // GET config
  if (pathname === '/api/config' && method === 'GET') {
    var config = readJSONFile(CONFIG_FILE, null);
    sendJSON(res, 200, { success: true, data: config });
    return true;
  }

  // POST config
  if (pathname === '/api/config' && method === 'POST') {
    readRequestBody(req, function(body) {
      try {
        var data = JSON.parse(body);
        var success = writeJSONFile(CONFIG_FILE, data);
        sendJSON(res, 200, { success: success, message: success ? 'Config saved' : 'Save failed' });
      } catch (e) {
        sendJSON(res, 400, { success: false, message: 'Invalid JSON' });
      }
    });
    return true;
  }

  // GET ratings
  if (pathname === '/api/ratings' && method === 'GET') {
    var ratings = readJSONFile(RATINGS_FILE, {});
    sendJSON(res, 200, { success: true, data: ratings });
    return true;
  }

  // POST ratings
  if (pathname === '/api/ratings' && method === 'POST') {
    readRequestBody(req, function(body) {
      try {
        var data = JSON.parse(body);
        var success = writeJSONFile(RATINGS_FILE, data);
        sendJSON(res, 200, { success: success, message: success ? 'Ratings saved' : 'Save failed' });
      } catch (e) {
        sendJSON(res, 400, { success: false, message: 'Invalid JSON' });
      }
    });
    return true;
  }

  // DELETE reset
  if (pathname === '/api/reset' && method === 'DELETE') {
    try {
      if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
      if (fs.existsSync(RATINGS_FILE)) fs.unlinkSync(RATINGS_FILE);
      sendJSON(res, 200, { success: true, message: 'Data reset' });
    } catch (e) {
      sendJSON(res, 500, { success: false, message: 'Reset failed' });
    }
    return true;
  }

  // GET available images - check images folder
  if (pathname === '/api/available-images' && method === 'GET') {
    var result = checkAvailableImages();
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  // GET level images - get image list for a specific level
  if (pathname.startsWith('/api/level-images/') && method === 'GET') {
    var levelId = pathname.replace('/api/level-images/', '');
    var result = getLevelImages(levelId);
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  // GET reference data - load reference JSON for a level
  if (pathname.startsWith('/api/reference-data/') && method === 'GET') {
    var levelId = pathname.replace('/api/reference-data/', '');
    var result = getReferenceData(levelId);
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  // GET rating standards - load rating standards for a specific level
  if (pathname.startsWith('/api/rating-standards/') && method === 'GET') {
    var levelId = pathname.replace('/api/rating-standards/', '');
    var result = getRatingStandards(levelId);
    sendJSON(res, 200, result);
    return true;
  }

  // GET knowledge graph - load full knowledge graph
  if (pathname === '/api/knowledge-graph' && method === 'GET') {
    var result = getKnowledgeGraph();
    sendJSON(res, 200, result);
    return true;
  }

  return false;
}

// Check available images in images folder
function checkAvailableImages() {
  var result = {
    hasImages: false,
    levels: {},
    total: 0
  };

  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('[DEBUG] Images directory not found:', IMAGES_DIR);
    return result;
  }

  var levelFolders = fs.readdirSync(IMAGES_DIR);
  var levelMap = {
    'accessibility': ['通达性', 'accessibility'],
    'safety': ['安全性', 'safety'],
    'comfort': ['舒适性', 'comfort'],
    'pleasantness': ['愉悦性', 'pleasantness']
  };

  levelFolders.forEach(function(folder) {
    var folderPath = path.join(IMAGES_DIR, folder);
    if (!fs.statSync(folderPath).isDirectory()) return;

    // Find matching level
    var levelId = null;
    for (var key in levelMap) {
      if (folder === levelMap[key][0] || folder.toLowerCase() === levelMap[key][1]) {
        levelId = key;
        break;
      }
    }

    // Count images - check both direct folder and images subfolder
    var imageCount = 0;

    // Check images subfolder first (e.g., images/通达性/images/)
    var imagesSubfolder = path.join(folderPath, 'images');
    if (fs.existsSync(imagesSubfolder) && fs.statSync(imagesSubfolder).isDirectory()) {
      var subFiles = fs.readdirSync(imagesSubfolder);
      imageCount = subFiles.filter(function(file) {
        var ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.indexOf(ext) !== -1;
      }).length;
    }

    // If no images in subfolder, check direct folder
    if (imageCount === 0) {
      var files = fs.readdirSync(folderPath);
      imageCount = files.filter(function(file) {
        var ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.indexOf(ext) !== -1;
      }).length;
    }

    console.log('[DEBUG] Folder:', folder, 'LevelId:', levelId, 'ImageCount:', imageCount);

    if (imageCount > 0) {
      result.hasImages = true;
      result.total += imageCount;
      result.levels[levelId || folder] = {
        folder: folder,
        count: imageCount
      };
    }
  });

  console.log('[DEBUG] checkAvailableImages result:', JSON.stringify(result));
  return result;
}

// Get level folder name by level ID
function getLevelFolder(levelId) {
  var levelMap = {
    'accessibility': '通达性',
    'safety': '安全性',
    'comfort': '舒适性',
    'pleasantness': '愉悦性'
  };

  // First check Chinese name
  var folder = levelMap[levelId];
  if (folder && fs.existsSync(path.join(IMAGES_DIR, folder))) {
    return folder;
  }

  // Then check English name
  if (fs.existsSync(path.join(IMAGES_DIR, levelId))) {
    return levelId;
  }

  // Try to find any folder matching
  if (fs.existsSync(IMAGES_DIR)) {
    var folders = fs.readdirSync(IMAGES_DIR);
    for (var i = 0; i < folders.length; i++) {
      var f = folders[i];
      if (f === levelId || f === levelMap[levelId]) {
        return f;
      }
    }
  }

  return null;
}

// Get image list for a specific level
function getLevelImages(levelId) {
  var result = {
    levelId: levelId,
    folder: null,
    images: [],
    hasReference: false
  };

  var folder = getLevelFolder(levelId);
  if (!folder) {
    return result;
  }

  result.folder = folder;
  var folderPath = path.join(IMAGES_DIR, folder);

  if (!fs.existsSync(folderPath)) {
    return result;
  }

  // Get images folder (might be in images subfolder or directly in level folder)
  var imagesPath = path.join(folderPath, 'images');
  if (fs.existsSync(imagesPath)) {
    folderPath = imagesPath;
  }

  // List images
  var files = fs.readdirSync(folderPath);
  files.forEach(function(file) {
    var ext = path.extname(file).toLowerCase();
    if (IMAGE_EXTENSIONS.indexOf(ext) !== -1) {
      result.images.push({
        name: file,
        url: '/images/' + folder + '/images/' + file
      });
    }
  });

  // Check for reference data
  var refFile = path.join(path.join(IMAGES_DIR, folder), folder + '_参考数据.json');
  if (fs.existsSync(refFile)) {
    result.hasReference = true;
    result.referenceUrl = '/images/' + folder + '/' + folder + '_参考数据.json';
  }

  return result;
}

// Get reference data for a level
function getReferenceData(levelId) {
  var result = {
    levelId: levelId,
    data: null
  };

  var folder = getLevelFolder(levelId);
  if (!folder) {
    return result;
  }

  var refFile = path.join(IMAGES_DIR, folder, folder + '_参考数据.json');
  if (fs.existsSync(refFile)) {
    try {
      result.data = readJSONFile(refFile, null);
    } catch (e) {
      console.error('[ERROR] Failed to read reference data:', e.message);
    }
  }

  return result;
}

// Get rating standards for a specific level
function getRatingStandards(levelId) {
  var result = {
    success: false,
    levelId: levelId,
    content: null,
    levelName: null,
    message: null
  };

  // Level name mapping
  var levelNames = {
    'accessibility': '通达性',
    'safety': '安全性',
    'comfort': '舒适性',
    'pleasantness': '愉悦性'
  };

  result.levelName = levelNames[levelId] || levelId;

  // Check if file exists
  if (!fs.existsSync(RATING_STANDARDS_FILE)) {
    console.log('[DEBUG] Rating standards file not found:', RATING_STANDARDS_FILE);
    result.message = '评分标准文件不存在';
    return result;
  }

  try {
    var content = fs.readFileSync(RATING_STANDARDS_FILE, 'utf-8');
    result.content = extractLevelSection(content, levelId);
    result.success = true;
    console.log('[DEBUG] Rating standards loaded for level:', levelId, 'content length:', result.content ? result.content.length : 0);
  } catch (e) {
    console.error('[ERROR] Failed to read rating standards:', e.message);
    result.message = '读取评分标准失败: ' + e.message;
  }

  return result;
}

// Extract specific level section from markdown content
function extractLevelSection(markdown, levelId) {
  var lines = markdown.split('\n');
  var levelHeaders = {
    'accessibility': '### 1. 通达性',
    'safety': '### 2. 安全性',
    'comfort': '### 3. 舒适性',
    'pleasantness': '### 4. 愉悦性'
  };

  var targetHeader = levelHeaders[levelId];
  if (!targetHeader) {
    return null;
  }

  // Find the section
  var startIndex = -1;
  var endIndex = lines.length;

  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === targetHeader) {
    startIndex = i;
    break;
    }
  }

  if (startIndex === -1) {
    return null;
  }

  // Find the end of section (next ### or ***)
  for (var i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('### ') && lines[i] !== targetHeader) {
    endIndex = i;
    break;
    }
    if (lines[i].startsWith('## 三、')) {
    endIndex = i;
    break;
    }
  }

  // Extract the section
  var section = lines.slice(startIndex, endIndex).join('\n');
  return section;
}

// Get full knowledge graph
function getKnowledgeGraph() {
  var result = {
    success: false,
    content: null,
    message: null
  };

  if (!fs.existsSync(KNOWLEDGE_GRAPH_FILE)) {
    console.log('[DEBUG] Knowledge graph file not found:', KNOWLEDGE_GRAPH_FILE);
    result.message = '知识图谱文件不存在';
    return result;
  }

  try {
    result.content = fs.readFileSync(KNOWLEDGE_GRAPH_FILE, 'utf-8');
    result.success = true;
    console.log('[DEBUG] Knowledge graph loaded, content length:', result.content.length);
  } catch (e) {
    console.error('[ERROR] Failed to read knowledge graph:', e.message);
    result.message = '读取知识图谱失败: ' + e.message;
  }

  return result;
}

// Serve static files
function serveStatic(req, res, pathname) {
  // Default file
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Decode URL
  try {
    pathname = decodeURIComponent(pathname);
  } catch (e) {
    // ignore
  }

  var filePath = path.join(ROOT_DIR, pathname);

  // Security: prevent directory traversal
  var resolvedPath = path.resolve(filePath);
  if (resolvedPath.indexOf(ROOT_DIR) !== 0) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Check if it's a directory
  var stats = fs.statSync(resolvedPath);
  if (stats.isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Get MIME type
  var ext = path.extname(resolvedPath).toLowerCase();
  var mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read and return file
  try {
    var content = fs.readFileSync(resolvedPath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (e) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

// Open browser
function openBrowser(url) {
  var command;
  if (process.platform === 'win32') {
    command = 'start "" "' + url + '"';
  } else if (process.platform === 'darwin') {
    command = 'open "' + url + '"';
  } else {
    command = 'xdg-open "' + url + '"';
  }
  exec(command, function(err) {
    if (err) console.log('[INFO] Please open browser manually: ' + url);
  });
}

// Create server
var server = http.createServer(function(req, res) {
  var pathname = req.url.split('?')[0];
  var method = req.method;

  var now = new Date();
  var time = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
  console.log('[' + time + '] ' + method + ' ' + pathname);

  // Handle API requests first
  if (pathname.indexOf('/api/') === 0) {
    if (!handleAPI(req, res, pathname, method)) {
      sendJSON(res, 404, { success: false, message: 'API not found' });
    }
    return;
  }

  // Serve static files
  serveStatic(req, res, pathname);
});

// Start server
server.listen(PORT, function() {
  var url = 'http://localhost:' + PORT;
  var configPath = path.relative(ROOT_DIR, CONFIG_FILE);
  var ratingsPath = path.relative(ROOT_DIR, RATINGS_FILE);

  console.log('');
  console.log('========================================');
  console.log('  Server Started Successfully');
  console.log('========================================');
  console.log('');
  console.log('  URL: ' + url);
  console.log('');
  console.log('  Data files:');
  console.log('    - Config:  ' + configPath);
  console.log('    - Ratings: ' + ratingsPath);
  console.log('');
  console.log('  Image folders:');
  console.log('    - images/accessibility/');
  console.log('    - images/safety/');
  console.log('    - images/comfort/');
  console.log('    - images/pleasantness/');
  console.log('');
  console.log('  Press Ctrl+C to stop the server');
  console.log('');
  console.log('========================================');
  console.log('');

  // Open browser automatically
  openBrowser(url);
});

// Handle shutdown
process.on('SIGINT', function() {
  console.log('\n[INFO] Server stopped');
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', function(err) {
  console.error('[ERROR] Server error:', err.message);
});
