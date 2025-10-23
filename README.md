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
- 2025.10.23 v0.52
  - 适配移动端（支持拖拽排序）

- 2025.10.22 v0.50
  - 换成更为先进的拖拽排序！

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

### 效果如图：
<img width="2560" height="1439" alt="PixPin_2025-10-23_15-11-02" src="https://github.com/user-attachments/assets/fb6b5882-68d5-4292-9d4f-dd1ea553614b" />
<img width="2560" height="1439" alt="PixPin_2025-10-23_15-11-16" src="https://github.com/user-attachments/assets/db2cd37b-a294-408d-a7ee-c247bf5b8f75" />
<img width="2560" height="1439" alt="PixPin_2025-10-23_15-08-41" src="https://github.com/user-attachments/assets/3dea55c2-98b0-4b29-ac62-e047b0d36050" />
![Honeycam 2025-10-23 15-31-57](https://github.com/user-attachments/assets/d64535cc-01d1-41e0-9b03-3371bb65a15d)

<img width="1279" height="1440" alt="PixPin_2025-10-23_15-30-32" src="https://github.com/user-attachments/assets/b4937a31-e78a-46a4-bc83-08a9ea9718d6" />

<img width="1278" height="1399" alt="163950sthv38ptwa8voqi8" src="https://github.com/user-attachments/assets/04c04650-617c-4a23-bcd3-9a771736ec75" />




## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=imgzcq/fn-icon&type=date&legend=top-left)](https://www.star-history.com/#imgzcq/fn-icon&type=date&legend=top-left)











