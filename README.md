# fn-icon

## 飞牛桌面图标管理工具

### 主要功能
- 自定义添加任意图标，跳转任意链接
- 能同时设置公网和内网连接
- 能够自动识别内外网跳转对应连接！
- 带有右键菜单，拓展更多功能
  
### 注意事项
1. 修改后没生效可能是浏览器缓存导致，尝试清空浏览器缓存或者使用无痕模式浏览效果

### 更新日志
- 2025.10.19 v0.35
  - 完善对内外网自动识别
  - 不输入图片URL则使用默认图标
  - 修复夜间模式右键菜单显示问题
  - 提升程序容错，对空项，漏填项识别和填充
  - （如需手动放置图片文件，请到compose文件所在的conf目录）

- 2025.10.18 v0.33之前
  - 初版发布
  - 对图标&图片的增删改查基操

### 使用方法
- 新建Docker compose粘贴以下代码：
  ```bash
  services:
  fn-icon:
    container_name: fn-icon
    image: imgzcq/cqfnicon:latest
    ports:
     - 9999:3000
    volumes:
     - /usr/trim/www:/public/fnwww
     - ./conf:/public/conf
    restart: always

效果如图：
