module.exports = {
    apps: [
        {
            name: "viper-web",
            cwd: "./apps/web",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
            },
            instances: 1,
            autorestart: true,
            max_memory_restart: "512M",
        },
        {
            name: "viper-socket",
            cwd: "./services/socket-server",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: 4000,
            },
            instances: 1,
            autorestart: true,
            max_memory_restart: "256M",
        },
    ],
};
