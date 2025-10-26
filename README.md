# <span style="color:#ff6b6b">fn-icon</span> 飞牛桌面图标管理工具

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin: 20px 0;">
  <h2 style="margin-top: 0;">实在太强大！</h2>
  <p style="font-size: 18px; margin-bottom: 0;">让飞牛成为你的导航页，解决Docker应用没有图标，代替收藏夹功能，想放什么就放什么！</p>
</div>

## <span style="color:#4ecdc4">主要功能</span>

<ul style="list-style-type: none; padding-left: 0;">
  <li style="background-color: #f7fafc; padding: 10px; margin: 8px 0; border-left: 4px solid #4ecdc4; border-radius: 4px;">
    ✨ 自定义添加任意图标，跳转任意链接
  </li>
  <li style="background-color: #f7fafc; padding: 10px; margin: 8px 0; border-left: 4px solid #4ecdc4; border-radius: 4px;">
    🌐 能同时设置公网和内网连接，自动识别
  </li>
  <li style="background-color: #f7fafc; padding: 10px; margin: 8px 0; border-left: 4px solid #4ecdc4; border-radius: 4px;">
    🖼️ 自动获取目标连接图标or自定义
  </li>
  <li style="background-color: #f7fafc; padding: 10px; margin: 8px 0; border-left: 4px solid #4ecdc4; border-radius: 4px;">
    ⚙️ 带有右键菜单，拓展更多功能
  </li>
</ul>

## <span style="color:#ffd166">注意事项</span>

<div style="background-color: #fff8e1; padding: 15px; border-radius: 8px; border: 1px solid #ffd166;">
  <strong style="color: #f59e0b;">⚠️ 重要提示：</strong>修改后没生效可能是浏览器缓存导致，尝试清空浏览器缓存或者使用无痕模式浏览效果
</div>

## <span style="color:#06d6a0">更新日志</span>

<div style="background-color: #f0fff4; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
  <h4 style="color: #16a34a; margin-top: 0;">2025.10.23 v0.52</h4>
  <ul>
    <li>✅ 适配移动端（支持拖拽排序）</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.22 v0.50</h4>
  <ul>
    <li>✅ 换成更为先进的拖拽排序！</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.21 v0.42</h4>
  <ul>
    <li>✅ 增加排序功能</li>
    <li>✅ 添加图标优先填补空缺位置</li>
    <li>✅ 增加公告按钮（左下角）</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.20 v0.39</h4>
  <ul>
    <li>✅ 支持从网址获取图标图片！</li>
    <li>✅ 样式微调</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.20 v0.38</h4>
  <ul>
    <li>✅ 全新的UI样式</li>
    <li>✅ 判断在系统启动完成后再添加图标，避免抢先启动导致失效</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.19 v0.37</h4>
  <ul>
    <li>✅ 增加登录验证页面！</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.19 v0.36</h4>
  <ul>
    <li>✅ 修复HTTPS对HTTP不能内网识别问题</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.19 v0.35</h4>
  <ul>
    <li>✅ 完善对内外网自动识别</li>
    <li>✅ 不输入图片URL则使用默认图标</li>
    <li>✅ 修复夜间模式右键菜单显示问题</li>
    <li>✅ 提升程序容错，对空项，漏填项识别和填充</li>
    <li>✅ （如需手动放置图片文件，请到compose文件所在的conf目录）</li>
  </ul>

  <h4 style="color: #16a34a;">2025.10.18 v0.33之前</h4>
  <ul>
    <li>✅ 初版发布</li>
    <li>✅ 对图标&图片的增删改查基操</li>
  </ul>
</div>

## <span style="color:#118ab2">使用方法</span>

<div style="background-color: #e6f7ff; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
  <h4 style="margin-top: 0;">新建Docker compose粘贴以下代码：</h4>
  
  <div style="background-color: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; overflow-x: auto;">
    <pre><code>services:
  fn-icon:
    container_name: fn-icon
    image: imgzcq/cqfnicon:latest
    ports:
     - 9999:3000
    volumes:
     - /usr/trim/www:/public/fnwww
     - ./conf:/public/conf
    restart: always</code></pre>
  </div>
</div>

## <span style="color:#7209b7">效果展示</span>

<div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">
  <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <img src="https://github.com/user-attachments/assets/fb6b5882-68d5-4292-9d4f-dd1ea553614b" alt="fn-icon界面展示1" style="width: 100%; height: auto;">
  </div>
  <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <img src="https://github.com/user-attachments/assets/db2cd37b-a294-408d-a7ee-c247bf5b8f75" alt="fn-icon界面展示2" style="width: 100%; height: auto;">
  </div>
  <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <img src="https://github.com/user-attachments/assets/3dea55c2-98b0-4b29-ac62-e047b0d36050" alt="fn-icon界面展示3" style="width: 100%; height: auto;">
  </div>
  <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <img src="https://github.com/user-attachments/assets/d64535cc-01d1-41e0-9b03-3371bb65a15d" alt="fn-icon界面展示4" style="width: 100%; height: auto;">
  </div>
  <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <img src="https://github.com/user-attachments/assets/b4937a31-e78a-46a4-bc83-08a9ea9718d6" alt="fn-icon移动端展示" style="width: 100%; height: auto;">
  </div>
  <div style="border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <img src="https://github.com/user-attachments/assets/04c04650-617c-4a23-bcd3-9a771736ec75" alt="fn-icon功能展示" style="width: 100%; height: auto;">
  </div>
</div>

## <span style="color:#f94144">Star History</span>

<div style="display: flex; justify-content: center; margin: 30px 0;">
  <a href="https://www.star-history.com/#imgzcq/fn-icon&type=date&legend=top-left" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; text-decoration: none; color: #495057; transition: all 0.3s ease;">
    <strong>查看项目星标历史</strong>
  </a>
</div>

<p style="text-align: center; color: #6c757d; font-style: italic;">Made with ❤️ by imgzcq</p>
