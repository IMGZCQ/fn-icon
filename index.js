const Koa = require('koa');
const { koaBody } = require('koa-body');
const static = require('koa-static');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { existsSync, mkdirSync, createWriteStream, createReadStream } = fs;
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// 生成密码哈希
const hashPassword = (password) => {
  // 使用SHA-256算法生成哈希
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
};

const app = new Koa();
const PORT = 3000;
const CONF_PATH = path.join(__dirname, 'public', 'conf');
const PASSWORD_FILE = path.join(__dirname, 'public', 'conf', 'password.json');

// 简单的Session管理
const sessions = new Map();
const generateSessionId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// 检查密码文件是否存在且包含有效的密码字段
const checkPasswordFile = () => {
  try {
    if (!fs.existsSync(path.dirname(PASSWORD_FILE))) {
      fs.mkdirSync(path.dirname(PASSWORD_FILE), { recursive: true });
    }
    if (!fs.existsSync(PASSWORD_FILE)) {
      return false;
    }
    // 读取文件内容并检查password字段
    const data = fs.readFileSync(PASSWORD_FILE, 'utf8');
    const config = JSON.parse(data);
    return config && typeof config.password === 'string' && config.password.trim().length > 0;
  } catch (error) {
    console.error('检查密码文件时出错:', error);
    return false;
  }
};

// 读取密码配置
const readPasswordConfig = () => {
  try {
    if (checkPasswordFile()) {
      const data = fs.readFileSync(PASSWORD_FILE, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('读取密码配置时出错:', error);
    return null;
  }
};

// 保存密码配置
const savePasswordConfig = (password, timeout = 30) => {
  try {
    // 对密码进行哈希处理后保存
    const hashedPassword = hashPassword(password);
    const config = { password: hashedPassword, timeout };
    fs.writeFileSync(PASSWORD_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('保存密码配置时出错:', error);
    return false;
  }
};

// 登录验证中间件
const authMiddleware = async (ctx, next) => {
  // 不需要验证的路径
  const excludedPaths = ['/login.html', '/api/login', '/api/init-password', '/styles.css', '/favicon.ico'];
  
  if (excludedPaths.some(path => ctx.path.startsWith(path))) {
    await next();
    return;
  }

  // 检查Session
  const sessionId = ctx.cookies.get('sessionId');
  if (sessionId && sessions.has(sessionId)) {
    const now = Date.now();
    const expiry = sessions.get(sessionId);
    
    if (now < expiry) {
      // 获取配置的超时时间以延长Session
      const passwordConfig = readPasswordConfig();
      const timeoutMinutes = passwordConfig?.timeout || 30;
      
      // 延长Session过期时间
      sessions.set(sessionId, now + (timeoutMinutes * 60 * 1000));
      
      // 更新Cookie过期时间
      ctx.cookies.set('sessionId', sessionId, {
        httpOnly: true,
        maxAge: timeoutMinutes * 60 * 1000,
        path: '/'
      });
      
      await next();
    } else {
      // Session已过期，删除并重定向到登录页
      sessions.delete(sessionId);
      ctx.cookies.set('sessionId', '', { expires: new Date(0) });
      ctx.redirect('/login.html');
    }
  } else {
    // 检查是否有密码配置
  try {
    if (fs.existsSync(PASSWORD_FILE)) {
      const data = fs.readFileSync(PASSWORD_FILE, 'utf8');
      const config = JSON.parse(data);
      // 如果密码字段不存在或为空，则重定向到初始化页面
      if (!config || typeof config.password !== 'string' || config.password.trim().length === 0) {
        ctx.redirect('/login.html?init=true');
        return;
      }
    }
    // 文件不存在或格式错误，也重定向到初始化页面
    ctx.redirect('/login.html?init=true');
  } catch (error) {
    console.error('检查密码配置时出错:', error);
    ctx.redirect('/login.html?init=true');
  }
  }
};

// 清理过期Session
const cleanupSessions = () => {
  const now = Date.now();
  for (const [sessionId, expiry] of sessions.entries()) {
    if (expiry < now) {
      sessions.delete(sessionId);
    }
  }
};

// 每5分钟清理一次过期Session
setInterval(cleanupSessions, 5 * 60 * 1000);

// 确保配置目录存在
if (!existsSync(CONF_PATH)) {
  mkdirSync(CONF_PATH, { recursive: true }); // 使用导入的mkdirSync而不是fs.mkdir
}

// 确保fnicon.json文件存在
const FNICON_PATH = path.join(CONF_PATH, 'fnicon.json');

// 获取网页内容函数 - 支持302重定向并添加详细日志
const fetchWebpageContent = async (url, redirectCount = 0) => {
  // 限制最大重定向次数
  if (redirectCount > 5) {
    throw new Error('重定向次数过多');
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    // 添加超时处理
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 10000); // 10秒超时
    protocol.get(url, (response) => {
      clearTimeout(timeout);
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http') 
          ? response.headers.location 
          : new URL(response.headers.location, url).href;
                // 递归调用以跟随重定向
        fetchWebpageContent(redirectUrl, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`请求失败: ${response.statusCode}`));
        return;
      }
      
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

// 提取一级域名的辅助函数
const getTopLevelDomain = (hostname) => {
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname; // 已经是一级域名或IP
  }
  // 对于包含多个子域名的情况，返回最后两个部分（一级域名和顶级域名）
  return parts.slice(-2).join('.');
};

// 从网页中提取图片URL函数 - 添加详细日志
const extractImageUrlFromWebpage = async (url) => {
  try {
    // 尝试直接访问域名下的favicon.ico
    const urlObj = new URL(url);
    const faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    
    // 尝试访问favicon.ico - 支持重定向
    try {
      // 只检查响应状态，不下载完整内容
      const faviconAccessible = await checkFaviconWithRedirect(faviconUrl);
      if (faviconAccessible) {
        return faviconUrl;
      } else {
        
        // 添加步骤1.5: 尝试访问一级域名的favicon.ico
        const topLevelDomain = getTopLevelDomain(urlObj.hostname);
        if (topLevelDomain !== urlObj.hostname) { // 只有当一级域名不同于当前域名时才尝试
          // 对于一级域名，保留原协议但不包含端口（一级域名通常不使用自定义端口）
          const topLevelFaviconUrl = `${urlObj.protocol}//${topLevelDomain}/favicon.ico`;
          
          try {
            const topLevelFaviconAccessible = await checkFaviconWithRedirect(topLevelFaviconUrl);
            if (topLevelFaviconAccessible) {
              return topLevelFaviconUrl;
            } else {
            }
          } catch (topLevelError) {
          }
        } else {
        }
      }
    } catch (faviconError) {
      
      // 即使出错，也尝试访问一级域名的favicon.ico
      const topLevelDomain = getTopLevelDomain(urlObj.hostname);
      if (topLevelDomain !== urlObj.hostname) {
        // 对于一级域名，保留原协议但不包含端口
        const topLevelFaviconUrl = `${urlObj.protocol}//${topLevelDomain}/favicon.ico`;
        
        try {
          const topLevelFaviconAccessible = await checkFaviconWithRedirect(topLevelFaviconUrl);
          if (topLevelFaviconAccessible) {
            return topLevelFaviconUrl;
          }
        } catch (topLevelError) {
        }
      }
    }
    
    // 如果favicon.ico不存在，尝试获取网页内容并提取第一个jpg或png图片
    const htmlContent = await fetchWebpageContent(url);
    
    // 尝试从link标签中提取favicon
    const faviconMatch = htmlContent.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["'][^>]*>/i);
    if (faviconMatch && faviconMatch[1]) {
      let faviconPath = faviconMatch[1];
      // 如果是相对路径，转换为绝对路径，保留端口
      if (!faviconPath.startsWith('http')) {
        // 使用host（包含端口）而不仅仅是hostname
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        faviconPath = new URL(faviconPath, baseUrl).href;
      }
      return faviconPath;
    } else {
    }
    
    // 尝试提取第一个jpg或png图片
    const imgMatch = htmlContent.match(/<img[^>]*src=["']([^"']*\.(jpg|png|ico))["'][^>]*>/i);
    if (imgMatch && imgMatch[1]) {
      let imgPath = imgMatch[1];
      // 如果是相对路径，转换为绝对路径，保留端口
      if (!imgPath.startsWith('http')) {
        // 使用host（包含端口）而不仅仅是hostname
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        imgPath = new URL(imgPath, baseUrl).href;
      }
      return imgPath;
    } else {
    }
    
    // 如果都没找到，返回null
    return null;
  } catch (error) {
    console.error(`✗ 错误: 提取图片URL时出错 - ${error.message}`);
    console.error(error.stack);
    return null;
  } finally {
  }
};

// 检查favicon是否可访问 - 支持重定向并添加详细日志
const checkFaviconWithRedirect = async (url, redirectCount = 0) => {
  
  if (redirectCount > 3) {
    throw new Error('favicon重定向次数过多');
  }
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error('favicon请求超时'));
    }, 5000);
    
    protocol.get(url, (response) => {
      clearTimeout(timeout);
      
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http') 
          ? response.headers.location 
          : new URL(response.headers.location, url).href;
        
        // 递归调用以跟随重定向
        checkFaviconWithRedirect(redirectUrl, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // 检查是否为有效的图片
      const isImage = response.statusCode === 200 && response.headers['content-type']?.includes('image/');
      if (isImage) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve(false); // 返回false而不是reject，让流程继续尝试其他方法
    });
  });
};

// 下载图片函数 - 支持302重定向
const downloadImage = async (url, savePath, redirectCount = 0) => {
  // 限制最大重定向次数
  if (redirectCount > 5) {
    throw new Error('重定向次数过多');
  }
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    // 添加超时处理
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 30000); // 30秒超时
    
    protocol.get(url, (response) => {
      clearTimeout(timeout);
      
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http') 
          ? response.headers.location 
          : new URL(response.headers.location, url).href;
      // 递归调用以跟随重定向
        downloadImage(redirectUrl, savePath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`请求失败: ${response.statusCode}`));
        return;
      }
      
      const fileStream = createWriteStream(savePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(savePath);
      });
      
      fileStream.on('error', (err) => {
        reject(err);
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

// 初始化下载图片的函数
const initializeImages = async () => {
  try {
    console.log('开始初始化图片下载...');
    const fniconContent = await fsPromises.readFile(FNICON_PATH, 'utf8');
    const data = JSON.parse(fniconContent);
    let hasUpdates = false;
    
    for (const item of data) {
      // 检查是否有网络图片URL且本地图片URL为空或不存在
      if (item['网络图片URL'] && (!item['本地图片URL'] || !existsSync(path.join(CONF_PATH, path.basename(item['本地图片URL']))))) {
        try {
          //console.log(`正在下载图片: ${item['标题']}`);
          const imgName = `${item.序号}_${item['标题'].replace(/[<>"/\\|\*\?]/g, '_').replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
          const imgPath = path.join(CONF_PATH, imgName);
          await downloadImage(item['网络图片URL'], imgPath);
          // 确保路径格式正确，前端可直接使用作为img src
          hasUpdates = true;
          //console.log(`图片下载成功: ${imgName}`);
        } catch (error) {
          console.error(`下载图片失败 (${item['标题']}):`, error.message);
        }
      item['本地图片URL'] = `/conf/${item.序号}_${item['标题'].replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
      }
    }
    
    // 如果有更新，保存到文件
    if (hasUpdates) {
      await fsPromises.writeFile(FNICON_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log('图片初始化完成，已更新本地图片URL');
    } else {
      console.log('所有图片已存在，无需更新');
    }
  } catch (error) {
    console.error('初始化图片时出错:', error);
  }
};
if (!existsSync(FNICON_PATH)) {
  console.log('配置文件不存在，先创建配置文件...');
  const defaultData = [
    {
      "序号": 1,
      "标题": "飞牛论坛",
      "外网跳转URL": "https://club.fnnas.com/",
      "内网跳转URL": "https://club.fnnas.com/",
      "本地图片URL": "",
      "网络图片URL": "https://help-static.fnnas.com/images/Margin-1.png"
    },
    {
      "序号": 2,
      "标题": "中科大测速",
      "外网跳转URL": "http://test.ustc.edu.cn/",
      "内网跳转URL": "http://test.ustc.edu.cn/",
      "本地图片URL": "",
      "网络图片URL": "http://test.ustc.edu.cn/favicon.ico"
    },
    {
      "序号": 3,
      "标题": "ImgURL图床",
      "外网跳转URL": "https://www.imgurl.org",
      "内网跳转URL": "https://www.imgurl.org",
      "本地图片URL": "",
      "网络图片URL": "https://www.imgurl.org/favicon.ico"
    },
    {
      "序号": 4,
      "标题": "IPIP Ping",
      "外网跳转URL": "https://tools.ipip.net/newping.php",
      "内网跳转URL": "https://tools.ipip.net/newping.php",
      "本地图片URL": "",
      "网络图片URL": "https://tools.ipip.net/favicon.ico"
    },
    {
      "序号": 5,
      "标题": "抖音",
      "外网跳转URL": "https://www.douyin.com/",
      "内网跳转URL": "https://www.douyin.com/",
      "本地图片URL": "",
      "网络图片URL": "https://pp.myapp.com/ma_icon/0/icon_42350811_1761048772/256"
    },
    {
      "序号": 6,
      "标题": "哔哩哔哩",
      "外网跳转URL": "https://www.bilibili.com/",
      "内网跳转URL": "https://www.bilibili.com/",
      "本地图片URL": "",
      "网络图片URL": "https://pp.myapp.com/ma_icon/0/icon_54221885_1755846090/256"
    },
    {
      "序号": 7,
      "标题": "随机壁纸",
      "外网跳转URL": "https://api.imlazy.ink/img",
      "内网跳转URL": "https://api.imlazy.ink/img",
      "本地图片URL": "",
      "网络图片URL": "https://pp.myapp.com/ma_icon/0/icon_54518091_1756196687/256"
    }
  ];
  // 创建默认文件
  fsPromises.writeFile(FNICON_PATH, JSON.stringify(defaultData, null, 2), 'utf8')
    .then(() => {
      console.log('默认配置文件创建成功');
      // 不再在这里调用initializeImages，统一在服务器启动流程中调用
    })
    .catch(err => console.error('创建配置文件失败:', err));
} else {
  // 如果文件已存在，不再在这里调用initializeImages，统一在服务器启动流程中调用
  console.log('配置文件已存在');
}


// 应用认证中间件
app.use(authMiddleware);

// 中间件
app.use(koaBody({
  json: true,          // 解析 JSON 格式
  form: true,          // 解析表单格式
  text: true           // 解析文本格式（可选）
}));
// 使用静态文件中间件，指向public目录
app.use(static(path.join(__dirname, 'public')));

// 初始化密码API
app.use(async (ctx, next) => {
  if (ctx.path === '/api/init-password' && ctx.method === 'POST') {
    const { password } = ctx.request.body;
    
    if (!password || password.length < 6) {
      ctx.body = { success: false, message: '密码长度至少6位' };
      return;
    }
    
    // 检查是否已初始化密码
    let existingConfig = null;
    try {
      if (fs.existsSync(PASSWORD_FILE)) {
        const data = fs.readFileSync(PASSWORD_FILE, 'utf8');
        existingConfig = JSON.parse(data);
      }
    } catch (error) {
      console.error('读取现有配置时出错:', error);
    }
    
    // 如果已有有效的password字段，则返回错误
    if (existingConfig && typeof existingConfig.password === 'string' && existingConfig.password.trim().length > 0) {
      ctx.body = { success: false, message: '密码已初始化，请直接登录' };
      return;
    }
    
    // 使用现有配置中的timeout（如果存在），否则使用默认值
    const timeout = existingConfig?.timeout || 30;
    
    if (savePasswordConfig(password, timeout)) {
      ctx.body = { success: true, message: '密码初始化成功，请登录' };
    } else {
      ctx.body = { success: false, message: '密码初始化失败，请重试' };
    }
    return;
  }
  await next();
});

// 登录API
app.use(async (ctx, next) => {
  if (ctx.path === '/api/login' && ctx.method === 'POST') {
    const { password } = ctx.request.body;
    
    // 检查密码是否已初始化
    const passwordConfig = readPasswordConfig();
    if (!passwordConfig || typeof passwordConfig.password !== 'string' || passwordConfig.password.trim().length === 0) {
      ctx.body = { success: false, message: '密码未初始化，请先初始化密码' };
      return;
    }
    
    // 对输入密码进行哈希处理后比较
    const hashedPassword = hashPassword(password);
    if (hashedPassword === passwordConfig.password) {
      // 创建Session，使用配置的超时时间（分钟转换为毫秒）
      const sessionId = generateSessionId();
      const timeoutMinutes = passwordConfig.timeout || 30;
      const sessionExpiry = Date.now() + (timeoutMinutes * 60 * 1000);
      sessions.set(sessionId, sessionExpiry);
      
      // 设置Cookie
      ctx.cookies.set('sessionId', sessionId, {
        httpOnly: true,
        maxAge: timeoutMinutes * 60 * 1000,
        path: '/'
      });
      
      ctx.body = { success: true, message: '登录成功' };
    } else {
      ctx.body = { success: false, message: '密码错误' };
    }
    return;
  }
  await next();
});

// 登出API
app.use(async (ctx, next) => {
  if (ctx.path === '/api/logout' && ctx.method === 'POST') {
    const sessionId = ctx.cookies.get('sessionId');
    if (sessionId && sessions.has(sessionId)) {
      sessions.delete(sessionId);
    }
    ctx.cookies.set('sessionId', '', { expires: new Date(0) });
    ctx.body = { success: true, message: '登出成功' };
    return;
  }
  await next();
});

// 公告内容代理API - 解决CORS问题
app.use(async (ctx, next) => {
  if (ctx.path === '/api/announcement' && ctx.method === 'GET') {
    try {
      const url = 'https://sh.on79.cfd/cqfnicon.txt';
      const protocol = url.startsWith('https') ? https : http;
      
      // 设置响应头，允许跨域
      ctx.set('Access-Control-Allow-Origin', '*');
      ctx.set('Access-Control-Allow-Methods', 'GET');
      
      // 使用Node.js的http/https模块获取远程内容
      const response = await new Promise((resolve, reject) => {
        protocol.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }).on('error', (error) => {
          reject(error);
        });
      });
      
      ctx.body = response;
      ctx.type = 'text/plain';
    } catch (error) {
      console.error('获取公告内容失败:', error);
      ctx.status = 500;
      ctx.body = '获取公告内容失败';
    }
    return;
  }
  await next();
});

// 读取JSON文件
const readJsonFile = async (filename) => {
  const filePath = path.join(CONF_PATH, filename);
  try {
    if (!existsSync(filePath)) {
      return { success: false, message: '文件不存1在' };
    }
    const data = await fsPromises.readFile(filePath, 'utf8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// 写入JSON文件
const writeJsonFile = async (filename, data) => {
  const filePath = path.join(CONF_PATH, filename);
  try {
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, message: '操作成功' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// 获取所有配置文件列表
app.use(async (ctx, next) => {
  if (ctx.path === '/api/files' && ctx.method === 'GET') {
    try {
      const files = await fsPromises.readdir(CONF_PATH);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      ctx.body = { success: true, data: jsonFiles };
    } catch (error) {
      ctx.body = { success: false, message: error.message };
    }
    return;
  }
  await next();
});

// 重新排序记录 - 放置在所有/api/files/*路由之前，确保优先处理
app.use(async (ctx, next) => {
  // 检查是否是reorder请求
  if (ctx.path.includes('/reorder') && ctx.method === 'POST') {
    try {
/*       console.log('Reorder API - Request received:', ctx.path);
 */      
      // 直接使用硬编码文件名以确保正确
      const filename = 'fnicon.json';
/*       console.log('Reorder API - Using filename:', filename);
      console.log('Reorder API - CONF_PATH:', CONF_PATH);
 */      
      // 构建完整文件路径
      const filePath = path.join(CONF_PATH, filename);
/*       console.log('Reorder API - Full file path:', filePath);
 */      
      // 检查文件是否存在
      if (!existsSync(filePath)) {
/*         console.error('CRITICAL: File does not exist:', filePath);
 */        ctx.body = { success: false, message: '配置文件不存在: ' + filePath };
        return;
      }
      
      // 获取请求体数据
      const requestBody = ctx.request.body;
/*       console.log('Reorder API - Received data length:', requestBody ? requestBody.length : 'no data');
 */      
      // 排序数据
      const sortedData = Array.isArray(requestBody) 
        ? [...requestBody].sort((a, b) => (a.序号 || 0) - (b.序号 || 0))
        : [];
      
      // 保存排序后的数据
      await fsPromises.writeFile(filePath, JSON.stringify(sortedData, null, 2));
/*       console.log('Reorder API - Successfully saved data to:', filePath);
 */      
      ctx.body = { success: true, message: '排序更新成功' };
    } catch (error) {
/*       console.error('Reorder API - Error:', error);
 */      ctx.body = { success: false, message: '排序更新失败: ' + error.message };
    }
    return; // 处理完后直接返回，不继续next()
  }
  
  // 不是reorder请求，继续处理其他路由
  await next();
});

// 获取指定文件内容
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/files/') && ctx.method === 'GET') {
    const filename = ctx.path.split('/api/files/')[1];
    const result = await readJsonFile(filename);
    
    // 如果读取成功且数据是数组，按照序号排序
    if (result.success && Array.isArray(result.data)) {
      // 对数据按照序号进行排序，处理序号可能不存在或不是数字的情况
      result.data = [...result.data].sort((a, b) => {
        const numA = typeof a.序号 === 'number' ? a.序号 : 0;
        const numB = typeof b.序号 === 'number' ? b.序号 : 0;
        return numA - numB;
      });
    }
    
    ctx.body = result;
    return;
  }
  await next();
});

// 下载图片函数已移至文件开头以确保函数声明顺序正确

// 添加记录
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/files/') && ctx.method === 'POST') {
    const filename = ctx.path.split('/api/files/')[1];
    const { data: currentData } = await readJsonFile(filename);
    const newRecord = ctx.request.body; 
    if (!currentData) {
      ctx.body = { success: false, message: '文件不存在' };
      return;
    }
    
    // 自动生成序号 - 优先填补空缺的序号
    if (currentData.length === 0) {
      newRecord.序号 = 1;
    } else {
      // 获取所有现有序号并排序，过滤出有效的数字序号
      const existingNumbers = currentData
        .map(item => item.序号)
        .filter(num => typeof num === 'number' && !isNaN(num) && num > 0)
        .sort((a, b) => a - b);
      
      // 如果没有有效的序号，从1开始
      if (existingNumbers.length === 0) {
        newRecord.序号 = 1;
      } else {
        // 寻找最小的空缺序号
        let minAvailableNumber = 1;
        for (const num of existingNumbers) {
          if (num > minAvailableNumber) {
            // 找到空缺
            break;
          }
          minAvailableNumber = num + 1;
        }
        
        newRecord.序号 = minAvailableNumber;
      }
    }
    
    
    // 处理网络图片URL，如果为空则尝试从外网跳转URL获取图片
    if (!newRecord['网络图片URL'] && newRecord['外网跳转URL']) {
      try {
        const extractedImageUrl = await extractImageUrlFromWebpage(newRecord['外网跳转URL']);
        if (extractedImageUrl) {
          newRecord['网络图片URL'] = extractedImageUrl;
        } else {
          // 如果无法提取图片，使用默认图标
          newRecord['网络图片URL'] = 'https://help-static.fnnas.com/images/Margin-1.png';
        }
      } catch (error) {
        // 出错时使用默认图标
        newRecord['网络图片URL'] = 'https://help-static.fnnas.com/images/Margin-1.png';
      }
    } else if (!newRecord['网络图片URL']) {
      // 如果没有外网跳转URL，直接使用默认图标
      newRecord['网络图片URL'] = 'https://help-static.fnnas.com/images/Margin-1.png';
    } else {
    }
    
    // 处理网络图片下载
    try {
      const imgName = `${newRecord.序号}_${newRecord.标题.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
      const imgPath = path.join(CONF_PATH, imgName);
      await downloadImage(newRecord['网络图片URL'], imgPath);
    } catch (error) {
      // 图片下载失败不影响记录添加，只记录错误
    }
    newRecord['本地图片URL'] = `/conf/${newRecord.序号}_${newRecord.标题.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
    
    currentData.push(newRecord);
    
    const writeResult = await writeJsonFile(filename, currentData);  
    ctx.body = writeResult;
    return;
  }
  await next();
});

// 更新记录
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/files/') && ctx.method === 'PUT') {
    const [filename, id] = ctx.path.split('/api/files/')[1].split('/');
    const { data: currentData } = await readJsonFile(filename);
    const requestBody = ctx.request.body;
    if (!currentData) {
      ctx.body = { success: false, message: '文件不存在' };
      return;
    }
    
    const index = currentData.findIndex(item => item.序号 === parseInt(id));
    if (index === -1) {
      ctx.body = { success: false, message: '记录不存在' };
      return;
    }
    const oldRecord = currentData[index];  
    const updatedRecord = { ...oldRecord, ...requestBody };
    // 如果更新了网络图片URL或网络图片URL为空，尝试从外网跳转URL获取图片
    const shouldUpdateImage = !updatedRecord['网络图片URL'] || 
                            (oldRecord['外网跳转URL'] !== updatedRecord['外网跳转URL']);
        
    if (shouldUpdateImage && updatedRecord['外网跳转URL']) {
      try {
        const extractedImageUrl = await extractImageUrlFromWebpage(updatedRecord['外网跳转URL']);
        if (extractedImageUrl) {
          updatedRecord['网络图片URL'] = extractedImageUrl;
        } else {
          // 如果无法提取图片，使用默认图标
          updatedRecord['网络图片URL'] = 'https://help-static.fnnas.com/images/Margin-1.png';
        }
      } catch (error) {
        // 出错时使用默认图标
        updatedRecord['网络图片URL'] = 'https://help-static.fnnas.com/images/Margin-1.png';
      }
    } else if (!updatedRecord['网络图片URL']) {
      // 如果没有外网跳转URL，直接使用默认图标
      updatedRecord['网络图片URL'] = 'https://help-static.fnnas.com/images/Margin-1.png';
    }
    
    if (updatedRecord['网络图片URL'] !== oldRecord['网络图片URL']) {
      try {
        const imgName = `${updatedRecord.序号}_${updatedRecord.标题.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
        const imgPath = path.join(CONF_PATH, imgName);
        await downloadImage(updatedRecord['网络图片URL'], imgPath);
        updatedRecord['本地图片URL'] = `/conf/${imgName}`;
      } catch (error) {
      }
    } else {
    }
    
    currentData[index] = updatedRecord;
    
    const writeResult = await writeJsonFile(filename, currentData);
    ctx.body = writeResult;
    return;
  }
  await next();
});

// 删除记录
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/files/') && ctx.method === 'DELETE') {
    const [filename, id] = ctx.path.split('/api/files/')[1].split('/');
    const { data: currentData } = await readJsonFile(filename);
    
    if (!currentData) {
      ctx.body = { success: false, message: '文件不存在' };
      return;
    }
    
    // 找到要删除的记录
    const recordToDelete = currentData.find(item => item.序号 === parseInt(id));
    
    // 如果找到记录且有本地图片URL，则删除本地图片文件
    if (recordToDelete && recordToDelete['本地图片URL']) {
      const imageUrl = recordToDelete['本地图片URL'];
      // 判断是否为本地图片（不是以http开头）
      if (imageUrl && !imageUrl.startsWith('http')) {
        // 移除URL开头的斜杠，避免路径拼接错误
        const sanitizedUrl = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
        const imagePath = path.join(__dirname, 'public', sanitizedUrl);
        try {
          if (existsSync(imagePath)) {
            await fsPromises.unlink(imagePath);
          }
        } catch (error) {
          // 继续删除记录，不因图片删除失败而中断
        }
      }
    }
    
    const newData = currentData.filter(item => item.序号 !== parseInt(id));
    ctx.body = await writeJsonFile(filename, newData);
    return;
  }
  await next();
});

// 应用设置到fnwww/index.html的函数
const applySettingsToHtml = async () => {
  try {
    // 先将conf文件夹复制到fnwww目录
    const sourceConfPath = path.join(__dirname, 'public', 'conf');
    const targetConfPath = path.join(__dirname, 'public', 'fnwww', 'conf');
    
    // 确保目标目录存在，如果不存在则创建
    if (!existsSync(targetConfPath)) {
      mkdirSync(targetConfPath, { recursive: true }); // 使用导入的mkdirSync而不是fs.mkdirSync
    } else {
      // 清空目标目录中的所有文件，防止残留文件
      const targetFiles = await fsPromises.readdir(targetConfPath);
      for (const file of targetFiles) {
        const filePath = path.join(targetConfPath, file);
        const stat = await fsPromises.stat(filePath);
        if (stat.isFile()) {
          await fsPromises.unlink(filePath);
        }
      }
      //console.log('fnwww/conf目录已清空');
    }
    
    // 复制conf文件夹中的所有文件
    const files = await fsPromises.readdir(sourceConfPath); // 使用重命名后的fsPromises
    for (const file of files) {
      const sourcePath = path.join(sourceConfPath, file);
      const targetPath = path.join(targetConfPath, file);
      
      // 使用流的方式复制文件，支持大文件
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(targetPath);
      
      await new Promise((resolve, reject) => {
        readStream.pipe(writeStream);
        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
      });
    }
    
    //console.log('conf文件夹复制完成');
    
    // 读取fnicon.json文件
    const fniconPath = path.join(__dirname, 'public', 'conf', 'fnicon.json');
    
    const fniconContent = await fsPromises.readFile(fniconPath, 'utf8');
    const data = JSON.parse(fniconContent);
    
    // 读取fnwww/index.html文件
    // 确保fnwww目录存在
      const publicDir = path.join(__dirname, 'public');
      const fnwwwDir = path.join(publicDir, 'fnwww');
      if (!existsSync(fnwwwDir)) {
        try {
          mkdirSync(fnwwwDir, { recursive: true });
          console.log('fnwww目录已创建');
        } catch (err) {
          console.error('创建fnwww目录失败:', err);
        }
      }
      const htmlPath = path.join(fnwwwDir, 'index.html');
      if (!existsSync(htmlPath)) {
        throw new Error('public/index.html文件不存在');
      }
    
    let htmlContent = await fsPromises.readFile(htmlPath, 'utf8');
    
    // 引用外部JavaScript文件
    const scriptContent = '\n  <script src="/script.js"></script>';
    
    // 清空body与div#root之间的内容，并插入script
    htmlContent = htmlContent.replace(/(<body[^>]*>)([\s\S]*?)(<div[^>]*id="root"[^>]*>)/, `$1${scriptContent}$3`);
    
    // 保存修改后的HTML文件
    await fsPromises.writeFile(htmlPath, htmlContent);
    
    return true;
  } catch (error) {
    console.error('应用设置失败:', error);
    throw error;
  }
};

// 处理应用设置的API
app.use(async (ctx, next) => {
  if (ctx.path === '/api/apply-settings' && ctx.method === 'POST') {
    try {
      await applySettingsToHtml();
      ctx.body = { success: true, message: '设置飞牛图标成功，请清空浏览器缓存并刷新！' };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { success: false, message: '应用图标设置失败: ' + error.message };
    }
    return;
  }
  await next();
});

// 启动服务器前执行初始化流程
(async () => {
  try {
    console.log('项目启动，开始初始化程序...');
    
    // 确保图片下载完成后再应用设置
    console.log('等待图片下载完成...');
    await initializeImages();
    
    // 检查public/fnwww/favicon.ico文件是否存在，等待该文件存在后才继续执行
    const faviconPath = path.join(__dirname, 'public', 'fnwww', 'favicon.ico');
    console.log('等待系统启动中。。。');
    let checkCount = 0;
    const maxChecks = 5;
    await new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        checkCount++;
        console.log(`第${checkCount}次评估系统状态...`);
        if (fs.existsSync(faviconPath)) {
          console.log('时机成熟，继续执行...');
          clearInterval(checkInterval);
          resolve();
        } else if (checkCount >= maxChecks) {
          console.log(`超过${maxChecks}次评估系统状态失败，先程序退出。`);
          clearInterval(checkInterval);
          // process.exit(1);
        }
      }, 1000); // 每秒检查一次
    });
    
    console.log('图片初始化完成，开始应用设置...');
    await applySettingsToHtml();
    
    // 在启动服务器前，将script.js复制到public/fnwww目录（如果文件已存在则覆盖）
    try {
        const sourcePath = path.join(__dirname, 'script.js');
        const targetPath = path.join(__dirname, 'public', 'fnwww', 'script.js');
        
        // 确保目标目录存在
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        
        // 复制文件（fs.copyFileSync默认会覆盖已存在的文件）
        fs.copyFileSync(sourcePath, targetPath);
        
        // 设置文件权限为644（所有者可读写，组用户可读，其他用户可读）
        fs.chmodSync(targetPath, 0o644);
        //console.log('成功将script.js复制到public/fnwww目录（已覆盖原有文件并设置权限644）');
    } catch (error) {
        console.error('复制script.js文件时出错:', error.message);
    }

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`米恋泥飞牛图标工具 艰难启动成功！`);
    });
  } catch (error) {
    console.error('初始化过程中出错:', error);
    console.log('继续启动服务器...');
    
    // 即使初始化失败，也尝试启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`米恋泥飞牛图标工具 艰难启动成功！`);
    });
  }

})();
