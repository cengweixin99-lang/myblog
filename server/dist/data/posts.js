// 初始模拟数据
let posts = [
    {
        id: 1,
        title: '欢迎来到我的博客',
        date: '2024-01-15',
        content: '第一篇正文...这是我的第一篇博客文章，欢迎大家阅读！',
        isTop: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        status: 'published'
    },
    {
        id: 2,
        title: 'React 学习笔记',
        date: '2024-01-10',
        content: '第二篇正文...记录我学习 React 的心得和体会。',
        createdAt: '2024-01-10T14:30:00Z',
        updatedAt: '2024-01-10T14:30:00Z',
        status: 'published'
    },
    {
        id: 3,
        title: 'TypeScript 入门指南',
        date: '2024-01-05',
        content: '第三篇正文...TypeScript 是 JavaScript 的超集，提供类型安全。',
        isTop: true,
        createdAt: '2024-01-05T09:00:00Z',
        updatedAt: '2024-01-05T09:00:00Z',
        status: 'published'
    },
    {
        id: 101,
        title: 'About Me',
        date: '2026-05-17',
        content: '关于我的极简介绍。我是一个热爱编程的开发者。',
        createdAt: '2026-05-17T16:00:00Z',
        updatedAt: '2026-05-17T16:00:00Z',
        status: 'published'
    },
    {
        id: 102,
        title: 'Things I like',
        date: '2026-05-17',
        content: '我喜欢的东西。包括编程、阅读、旅行和美食。',
        createdAt: '2026-05-17T17:00:00Z',
        updatedAt: '2026-05-17T17:00:00Z',
        status: 'published'
    },
    {
        id: 103,
        title: "Things I don't like",
        date: '2026-05-17',
        content: '我不喜欢的东西。比如拖延和不尊重他人的行为。',
        createdAt: '2026-05-17T18:00:00Z',
        updatedAt: '2026-05-17T18:00:00Z',
        status: 'published'
    }
];
let nextId = 104;
// 转换函数：Post -> PostSummary
function toSummary(post) {
    const { content, ...summary } = post;
    return summary;
}
// CRUD 操作
export const postStore = {
    // 获取所有帖子摘要（不含 content）- 仅 published（客户端用）
    getAllSummaries() {
        return posts.filter(post => post.status === 'published').map(toSummary);
    },
    // 获取所有帖子摘要（含 draft，用于管理端）
    getAllSummariesAdmin() {
        return posts.map(toSummary);
    },
    // 获取单个帖子
    getById(id) {
        return posts.find(post => post.id === id);
    },
    // 获取置顶帖子摘要（不含 content）- 仅 published
    getTopSummaries() {
        return posts.filter(post => post.isTop && post.status === 'published').map(toSummary);
    },
    // 获取置顶帖子摘要（管理端用，仅 top 不管 status）
    getTopSummariesAdmin() {
        return posts.filter(post => post.isTop).map(toSummary);
    },
    // 创建帖子
    create(post) {
        const now = new Date().toISOString();
        const newPost = {
            ...post,
            id: nextId++,
            createdAt: now,
            updatedAt: now
        };
        posts.push(newPost);
        return newPost;
    },
    // 更新帖子
    update(id, updates) {
        const index = posts.findIndex(post => post.id === id);
        if (index === -1)
            return null;
        posts[index] = {
            ...posts[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        return posts[index];
    },
    // 删除帖子
    delete(id) {
        const initialLength = posts.length;
        posts = posts.filter(post => post.id !== id);
        return posts.length < initialLength;
    },
    // 切换置顶状态
    toggleTop(id) {
        const index = posts.findIndex(post => post.id === id);
        if (index === -1)
            return null;
        posts[index] = {
            ...posts[index],
            isTop: !posts[index].isTop,
            updatedAt: new Date().toISOString()
        };
        return posts[index];
    }
};
