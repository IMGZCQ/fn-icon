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
<img width="1278" height="1399" alt="163950sthv38ptwa8voqi8" src="https://github.com/user-attachments/assets/04c04650-617c-4a23-bcd3-9a771736ec75" />
![Honeycam 2025-10-18 14-39-20](https://github.com/user-attachments/assets/ac52d99a-771f-41d5-a2fa-4fda997a1136)
![163937sw3000f0st0ajt44](https://github.com/user-attachments/assets/267e1dac-6f01-4e7f-b653-212779adb967)
<img width="421" height="190" alt="012238en9f9djb31abt97m" src="https://github.com/user-attachments/assets/5750fbf3-8d82-4b1a-8133-5286d6a77e90" />











