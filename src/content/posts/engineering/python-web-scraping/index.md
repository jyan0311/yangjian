---
title: "Python数据爬取实战：从入门到入土"
description: "分享我在数据爬取过程中学到的技巧和踩过的坑"
date: "2026-01-18"
tags: ["Coding", "合集", "Python"]
featured: false
draft: false
---

# Python数据爬取实战：从入门到入土

## 🕷️ 爬虫基础

### 工具选择

**BeautifulSoup vs Scrapy vs Selenium**

| 工具 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| BeautifulSoup | 简单静态页面 | 易学易用 | 效率较低 |
| Scrapy | 大规模爬取 | 高效、功能强大 | 学习曲线陡峭 |
| Selenium | 动态页面 | 模拟真实浏览器 | 速度慢、资源占用高 |

### 我的工具箱
```python
import requests
import pandas as pd
from bs4 import BeautifulSoup
import time
import random
from fake_useragent import UserAgent
```

## 🎯 实战案例

### 案例1：爬取Reddit热门帖子

**目标：** 获取r/MachineLearning的热门帖子标题和评论数

```python
def scrape_reddit_ml():
    url = "https://www.reddit.com/r/MachineLearning/hot/"
    headers = {
        'User-Agent': UserAgent().random
    }
    
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    posts = []
    # 解析逻辑...
    return posts
```

**踩坑记录：**
- Reddit有rate limiting，需要添加延迟
- User-Agent很重要，不然容易被ban
- 数据结构经常变化，爬虫需要维护

### 案例2：学术论文数据收集

**目标：** 从arXiv收集特定主题的论文信息

**挑战：**
1. arXiv的API限制
2. 论文信息格式不统一
3. 大量数据的存储和处理

**解决方案：**
```python
import arxiv

def collect_papers(query, max_results=100):
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance
    )
    
    papers = []
    for result in search.results():
        papers.append({
            'title': result.title,
            'authors': [author.name for author in result.authors],
            'abstract': result.summary,
            'url': result.pdf_url
        })
    
    return papers
```

### 案例3：电商价格监控

**目标：** 监控特定商品的价格变化

**技术栈：**
- Selenium（处理动态内容）
- SQLite（数据存储）
- Crontab（定时任务）

**反爬虫对策：**
1. 随机延迟：`time.sleep(random.uniform(1, 3))`
2. 代理轮换：避免IP被封
3. 浏览器自动化：模拟人类行为

## 🚫 反爬虫与应对策略

### 常见反爬虫手段

**1. User-Agent检测**
```python
from fake_useragent import UserAgent
ua = UserAgent()
headers = {'User-Agent': ua.random}
```

**2. IP限制**
```python
import requests
proxies = {
    'http': 'http://proxy-server:port',
    'https': 'https://proxy-server:port'
}
response = requests.get(url, proxies=proxies)
```

**3. 验证码**
- 使用打码平台API
- 训练自己的验证码识别模型
- 避免触发验证码（降低请求频率）

### 最佳实践

**1. 尊重robots.txt**
```python
import urllib.robotparser

def can_crawl(url, user_agent='*'):
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(url + '/robots.txt')
    rp.read()
    return rp.can_fetch(user_agent, url)
```

**2. 合理设置延迟**
```python
def polite_crawler():
    for url in urls:
        # 爬取逻辑
        time.sleep(random.uniform(1, 3))  # 随机延迟
```

**3. 异常处理**
```python
def robust_request(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 指数退避
    return None
```

## 📊 数据处理与存储

### 数据清洗
```python
def clean_data(raw_data):
    df = pd.DataFrame(raw_data)
    
    # 去重
    df = df.drop_duplicates()
    
    # 处理空值
    df = df.dropna(subset=['title', 'url'])
    
    # 数据标准化
    df['title'] = df['title'].str.strip()
    
    return df
```

### 数据存储选择

**小数据量：** CSV、JSON
**中等数据量：** SQLite
**大数据量：** PostgreSQL、MongoDB

## ⚖️ 法律与道德考量

### 注意事项
1. **遵守网站Terms of Service**
2. **不要过载服务器**
3. **保护个人隐私信息**
4. **商业用途需要特别注意版权**

### 推荐阅读
- 各国数据保护法规（GDPR、CCPA等）
- Web Scraping的法律边界
- 学术研究中的数据使用规范

## 🛠️ 实用工具推荐

### 开发工具
- **Postman：** API测试
- **Chrome DevTools：** 网页结构分析
- **Jupyter Notebook：** 数据分析和可视化

### Python库
- **requests-html：** 处理JavaScript渲染的页面
- **scrapy-splash：** 处理SPA应用
- **newspaper3k：** 新闻文章提取

## 🎯 进阶技巧

### 1. 分布式爬虫
使用Scrapy-Redis实现分布式爬取：
```python
# settings.py
SCHEDULER = "scrapy_redis.scheduler.Scheduler"
DUPEFILTER_CLASS = "scrapy_redis.dupefilter.RFPDupeFilter"
```

### 2. 机器学习辅助
- 使用ML模型识别有用信息
- 自动化分类和标注
- 智能去重和数据质量评估

### 3. 云部署
- AWS Lambda：无服务器爬虫
- Docker：环境一致性
- Kubernetes：大规模部署

## 总结

爬虫是一门平衡技巧、效率和道德的艺术。记住：
- **技术服务于目标，不要为了爬而爬**
- **始终保持对网站和用户的尊重**
- **持续学习新技术和最佳实践**

Happy scraping! 🕷️✨

**下期预告：** 《如何用ChatGPT辅助代码调试》