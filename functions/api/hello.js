// 处理GET请求，返回Node.js环境信息
export async function onRequestGet(context) {
  const nodeVersion = process.version; // Node.js版本（兼容层提供）
  return new Response(`Node.js version: ${nodeVersion}`, {
    headers: { "Content-Type": "text/plain" },
  });
}