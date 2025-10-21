# fn-icon

## 飞牛桌面图标管理工具

### 实在太强大，让飞牛成为你的导航页，解决Docker应用没有图标，代替收藏夹功能，想放什么就放什么！
### 主要功能
- 自定义添加任意图标，跳转任意链接
- 能同时设置公网和内网连接，自动识别
- 自动获取目标连接图标or自定义
- 带有右键菜单，拓展更多功能
  
### 注意事项
1. 修改后没生效可能是浏览器缓存导致，尝试清空浏览器缓存或者使用无痕模式浏览效果

### 更新日志
- 2025.10.21 v0.42
  - 增加排序功能
  - 添加图标优先填补空缺位置
  - 增加公告按钮（左下角）

- 2025.10.20 v0.39
  - 支持从网址获取图标图片！
  - 样式微调

- 2025.10.20 v0.38
  - 全新的UI样式
  - 判断在系统启动完成后再添加图标，避免抢先启动导致失效

- 2025.10.19 v0.37
  - 增加登录验证页面！

- 2025.10.19 v0.36
  - 修复HTTPS对HTTP不能内网识别问题

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
<img width="1146" height="1463" alt="image" src="https://github.com/user-attachments/assets/15467490-8c55-4cff-8602-27b7e848cdc0" />
<img width="1280" height="1400" alt="PixPin_2025-10-20_11-23-53" src="https://github.com/user-attachments/assets/8dfa5afc-2dc6-4a6a-9b8a-2b23a9fdd8aa" />
<img width="728" height="849" alt="PixPin_2025-10-20_11-23-28" src="https://github.com/user-attachments/assets/61e912ad-33d2-46b0-a780-9f9cd4ce2d39" />
<img width="693" height="939" alt="PixPin_2025-10-20_11-24-36" src="https://github.com/user-attachments/assets/cc3317c6-af66-4804-a6d7-0d78c6803e89" />
<img width="1278" height="1399" alt="163950sthv38ptwa8voqi8" src="https://github.com/user-attachments/assets/04c04650-617c-4a23-bcd3-9a771736ec75" />
![Honeycam 2025-10-18 14-39-20](https://github.com/user-attachments/assets/ac52d99a-771f-41d5-a2fa-4fda997a1136)
![163937sw3000f0st0ajt44](https://github.com/user-attachments/assets/267e1dac-6f01-4e7f-b653-212779adb967)
<img width="715" height="805" alt="PixPin_2025-10-19_17-30-15" src="https://github.com/user-attachments/assets/6a1d08c2-d251-4a35-af59-e267d11aab89" />
<img width="421" height="190" alt="012238en9f9djb31abt97m" src="https://github.com/user-attachments/assets/5750fbf3-8d82-4b1a-8133-5286d6a77e90" />

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=imgzcq/fn-icon&type=date&legend=top-left)](https://www.star-history.com/#imgzcq/fn-icon&type=date&legend=top-left)











