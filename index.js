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

// 下载图片函数
const downloadImage = async (url, savePath) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    // 添加超时处理
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 30000); // 30秒超时
    
    protocol.get(url, (response) => {
      clearTimeout(timeout);
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
      "网络图片URL": "https://img.on79.cfd/file/1760761140128_1_飞牛论坛.jpg"
    },
    {
      "序号": 2,
      "标题": "中科大测速",
      "外网跳转URL": "http://test.ustc.edu.cn/",
      "内网跳转URL": "http://test.ustc.edu.cn/",
      "本地图片URL": "",
      "网络图片URL": "https://img.on79.cfd/file/1760761140429_2_中科大测速.jpg"
    },
    {
      "序号": 3,
      "标题": "随机壁纸",
      "外网跳转URL": "https://api.imlazy.ink/img",
      "内网跳转URL": "https://api.imlazy.ink/img",
      "本地图片URL": "",
      "网络图片URL": "https://img.on79.cfd/file/1760761144818_3_随机壁纸.jpg"
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

// 读取JSON文件
const readJsonFile = async (filename) => {
  const filePath = path.join(CONF_PATH, filename);
  try {
    if (!existsSync(filePath)) {
      return { success: false, message: '文件不存在' };
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

// 获取指定文件内容
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/files/') && ctx.method === 'GET') {
    const filename = ctx.path.split('/api/files/')[1];
    ctx.body = await readJsonFile(filename);
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
    
    if (!currentData) {
      ctx.body = { success: false, message: '文件不存在' };
      return;
    }
    
    const newRecord = ctx.request.body;
    // 自动生成序号
    newRecord.序号 = currentData.length > 0 
      ? Math.max(...currentData.map(item => item.序号)) + 1 
      : 1;
    
    // 处理网络图片URL，如果为空则使用默认图标
    if (!newRecord['网络图片URL']) {
      newRecord['网络图片URL'] = 'https://fnnas.com/favicon.ico';
    }
    
    // 处理网络图片下载
    try {
      const imgName = `${newRecord.序号}_${newRecord.标题.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
      const imgPath = path.join(CONF_PATH, imgName);
      await downloadImage(newRecord['网络图片URL'], imgPath);
    } catch (error) {
      console.error('下载图片失败:', error);
      // 图片下载失败不影响记录添加，只记录错误
    }
    newRecord['本地图片URL'] = `/conf/${newRecord.序号}_${newRecord.标题.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
    currentData.push(newRecord);
    ctx.body = await writeJsonFile(filename, currentData);
    return;
  }
  await next();
});

// 更新记录
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/files/') && ctx.method === 'PUT') {
    const [filename, id] = ctx.path.split('/api/files/')[1].split('/');
    const { data: currentData } = await readJsonFile(filename);
    
    if (!currentData) {
      ctx.body = { success: false, message: '文件不存在' };
      return;
    }
    
    const index = currentData.findIndex(item => item.序号 === parseInt(id));
    if (index === -1) {
      ctx.body = { success: false, message: '记录不存在' };
      return;
    }
    
    const updatedRecord = { ...currentData[index], ...ctx.request.body };
    
    // 如果更新了网络图片URL或网络图片URL为空，设置默认图标并重新下载
    if (!updatedRecord['网络图片URL']) {
      updatedRecord['网络图片URL'] = 'https://fnnas.com/favicon.ico';
    }
    
    if (updatedRecord['网络图片URL'] !== currentData[index]['网络图片URL']) {
      try {
        const imgName = `${updatedRecord.序号}_${updatedRecord.标题.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`;
        const imgPath = path.join(CONF_PATH, imgName);
        await downloadImage(updatedRecord['网络图片URL'], imgPath);
        updatedRecord['本地图片URL'] = `/conf/${imgName}`;
      } catch (error) {
        console.error('下载图片失败:', error);
      }
    }
    
    currentData[index] = updatedRecord;
    ctx.body = await writeJsonFile(filename, currentData);
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
            console.log(`已删除本地图片文件: ${imagePath}`);
          }
        } catch (error) {
          console.error(`删除本地图片文件失败: ${error.message}`);
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
    
/*     // 检查public/fnwww/favicon.ico文件是否存在，等待该文件存在后才继续执行
    const faviconPath = path.join(__dirname, 'public', 'fnwww', 'favicon.ico');
    console.log('等待系统启动中。。。');
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (fs.existsSync(faviconPath)) {
          console.log('时机成熟，继续执行...');
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000); // 每秒检查一次
    }); */
    
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
const port = process.env.PORT || 3000;
// 2. 监听所有网络接口（0.0.0.0），而不是 localhost
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
  } catch (error) {
    console.error('初始化过程中出错:', error);
    console.log('继续启动服务器...');
    
    // 即使初始化失败，也尝试启动服务器
const port = process.env.PORT || 3000;
// 2. 监听所有网络接口（0.0.0.0），而不是 localhost
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
  }

})();
