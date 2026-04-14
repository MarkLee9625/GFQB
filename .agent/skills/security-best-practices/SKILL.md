---
name: security-best-practices
description: 提供项目安全最佳实践，包括API安全、数据安全、认证授权、输入验证等方面。
---

# 项目安全最佳实践 (Security Best Practices)

此 Skill 用于指导如何在项目中实施安全最佳实践，保护应用和用户数据的安全。

## 何时使用

- 开发新功能时
- 代码审查时
- 处理敏感数据时
- 部署应用前

## 1. API 安全

### 1.1 API 密钥管理
- **环境变量**: 使用环境变量存储 API 密钥，避免硬编码在代码中
- **密钥轮换**: 定期轮换 API 密钥
- **最小权限**: 为 API 密钥设置最小必要权限

### 1.2 请求验证
- **参数验证**: 验证所有 API 请求参数
- **速率限制**: 实施 API 速率限制，防止暴力攻击
- **HTTPS**: 确保所有 API 请求使用 HTTPS

### 1.3 错误处理
- **避免暴露敏感信息**: 错误消息不应包含敏感信息
- **统一错误处理**: 实现统一的错误处理机制

```typescript
// 错误示例：暴露敏感信息
try {
  // API 调用
} catch (error) {
  console.error('数据库连接失败:', error);
  throw new Error('数据库连接失败: ' + error.message);
}

// 正确示例：隐藏敏感信息
try {
  // API 调用
} catch (error) {
  console.error('API 调用失败:', error);
  throw new Error('服务暂时不可用，请稍后重试');
}
```

## 2. 数据安全

### 2.1 数据加密
- **传输加密**: 使用 HTTPS 加密传输数据
- **存储加密**: 敏感数据在存储前进行加密
- **密码哈希**: 使用 bcrypt 等算法哈希存储密码

### 2.2 数据处理
- **最小数据收集**: 只收集必要的数据
- **数据脱敏**: 展示敏感数据时进行脱敏处理
- **数据销毁**: 不再需要的数据应及时销毁

### 2.3 第三方服务
- **数据传输**: 向第三方服务发送数据时确保安全
- **隐私政策**: 遵守相关隐私法规

## 3. 认证授权

### 3.1 认证
- **强密码策略**: 要求使用强密码
- **多因素认证**: 支持多因素认证
- **会话管理**: 安全管理用户会话

### 3.2 授权
- **基于角色的访问控制**: 实施基于角色的访问控制
- **权限检查**: 对敏感操作进行权限检查
- **最小权限**: 遵循最小权限原则

### 3.3 JWT 安全
- **密钥管理**: 安全存储 JWT 密钥
- **过期时间**: 设置合理的 JWT 过期时间
- **刷新机制**: 实现安全的 token 刷新机制

```typescript
// JWT 配置示例
const jwtOptions = {
  secret: process.env.JWT_SECRET,
  expiresIn: '1h', // 合理的过期时间
  algorithm: 'HS256'
};

// 验证 token 中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
```

## 4. 输入验证

### 4.1 客户端验证
- **表单验证**: 对用户输入进行客户端验证
- **类型检查**: 确保输入数据类型正确
- **长度限制**: 限制输入长度，防止过长输入

### 4.2 服务端验证
- **服务器端验证**: 所有输入必须在服务器端进行验证
- **参数过滤**: 过滤恶意输入
- **SQL 注入防护**: 使用参数化查询或 ORM 防止 SQL 注入

### 4.3 示例
```typescript
// 输入验证示例
function validateUserInput(input) {
  const errors = [];
  
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('请输入有效的邮箱地址');
  }
  
  if (!input.password || input.password.length < 8) {
    errors.push('密码长度至少为 8 个字符');
  }
  
  return errors;
}
```

## 5. 防止 XSS 攻击

### 5.1 输入转义
- **HTML 转义**: 对用户输入进行 HTML 转义
- **危险字符过滤**: 过滤危险字符和标签

### 5.2 Content-Security-Policy
- **CSP 配置**: 实施 Content-Security-Policy 头部
- **脚本源限制**: 限制可执行脚本的来源

### 5.3 React 安全
- **JSX 自动转义**: 利用 React JSX 的自动转义功能
- **dangerouslySetInnerHTML**: 谨慎使用 dangerouslySetInnerHTML

```tsx
// 安全示例：使用 JSX 自动转义
function UserComment({ comment }) {
  return <div>{comment}</div>; // JSX 会自动转义
}

// 不安全示例：直接插入 HTML
function UnsafeComment({ comment }) {
  return <div dangerouslySetInnerHTML={{ __html: comment }} />; // 可能导致 XSS
}
```

## 6. 防止 CSRF 攻击

### 6.1 CSRF 令牌
- **CSRF 令牌**: 为每个表单添加 CSRF 令牌
- **验证令牌**: 服务器端验证 CSRF 令牌

### 6.2 同源策略
- **SameSite Cookie**: 设置 Cookie 的 SameSite 属性
- **Origin 检查**: 验证请求的 Origin 头

### 6.3 示例
```typescript
// CSRF 令牌生成和验证
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateCsrfToken(token, sessionToken) {
  return token === sessionToken;
}
```

## 7. 依赖安全

### 7.1 依赖管理
- **定期更新**: 定期更新依赖包
- **安全扫描**: 使用工具扫描依赖包的安全漏洞
- **锁定版本**: 使用 package-lock.json 或 yarn.lock 锁定依赖版本

### 7.2 安全工具
- **npm audit**: 使用 npm audit 检查依赖安全
- **Snyk**: 使用 Snyk 等工具监控依赖安全
- **OWASP Dependency-Check**: 使用 OWASP Dependency-Check 扫描依赖

### 7.3 示例
```bash
# 检查依赖安全
npm audit

# 更新依赖
npm update

# 锁定依赖版本
npm shrinkwrap
```

## 8. 安全配置

### 8.1 服务器配置
- **HTTPS**: 启用 HTTPS
- **安全头部**: 设置安全相关的 HTTP 头部
- **禁用不必要的服务**: 禁用不必要的服务器服务

### 8.2 前端配置
- **环境变量**: 正确配置环境变量
- **调试信息**: 生产环境中禁用调试信息
- **错误处理**: 生产环境中隐藏详细错误信息

### 8.3 示例
```javascript
// 生产环境配置
if (process.env.NODE_ENV === 'production') {
  // 禁用控制台日志
  console.log = () => {};
  
  // 隐藏错误详情
  app.use((err, req, res, next) => {
    res.status(500).send('服务器内部错误');
  });
}
```

## 9. 安全测试

### 9.1 渗透测试
- **定期渗透测试**: 定期进行渗透测试
- **安全审计**: 定期进行安全审计

### 9.2 自动化测试
- **安全测试**: 编写安全相关的自动化测试
- **CI/CD 集成**: 在 CI/CD 流程中集成安全测试

### 9.3 代码审查
- **安全代码审查**: 进行安全代码审查
- **安全检查清单**: 使用安全检查清单

## 10. 安全响应

### 10.1 漏洞响应
- **漏洞报告**: 建立漏洞报告机制
- **漏洞修复**: 及时修复发现的漏洞
- **安全公告**: 必要时发布安全公告

### 10.2 事件响应
- **事件响应计划**: 制定安全事件响应计划
- **应急演练**: 定期进行安全应急演练
- **事后分析**: 对安全事件进行事后分析

## 最佳实践总结

1. **安全意识**: 提高团队的安全意识
2. **持续学习**: 关注最新的安全威胁和防护措施
3. **安全设计**: 在设计阶段考虑安全因素
4. **分层防护**: 实施多层安全防护
5. **最小权限**: 遵循最小权限原则
6. **定期审计**: 定期进行安全审计
7. **及时更新**: 及时更新依赖和系统
8. **安全测试**: 进行全面的安全测试

## 常见安全问题

### Q: 如何防止 SQL 注入攻击？
**A:** 使用参数化查询或 ORM，避免直接拼接 SQL 语句。

### Q: 如何防止 XSS 攻击？
**A:** 对用户输入进行 HTML 转义，实施 Content-Security-Policy，谨慎使用 dangerouslySetInnerHTML。

### Q: 如何安全管理 API 密钥？
**A:** 使用环境变量存储 API 密钥，定期轮换密钥，设置最小权限。

### Q: 如何防止 CSRF 攻击？
**A:** 为每个表单添加 CSRF 令牌，设置 Cookie 的 SameSite 属性，验证请求的 Origin 头。

### Q: 如何确保依赖包的安全？
**A:** 定期更新依赖包，使用工具扫描依赖包的安全漏洞，锁定依赖版本。