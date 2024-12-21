const FISH_TYPES = {
    NORMAL: {
        color: '#7FDBDA',
        speedMultiplier: 1,
        scoreMultiplier: 1,
        name: '普通鱼'
    },
    SPEED: {
        color: '#FFC857',
        speedMultiplier: 2,
        scoreMultiplier: 2,
        name: '快速鱼'
    },
    GIANT: {
        color: '#FF3366',
        speedMultiplier: 0.7,
        sizeMultiplier: 1.5,
        scoreMultiplier: 3,
        name: '大型鱼'
    },
    TINY: {
        color: '#9EE493',
        speedMultiplier: 1.5,
        sizeMultiplier: 0.7,
        scoreMultiplier: 2,
        name: '小型鱼'
    }
};

let highScore = localStorage.getItem('fishGameHighScore') || 0;

// 添加游戏状态控制
const GAME_STATE = {
    RUNNING: 'running',
    PAUSED: 'paused',
    ENDED: 'ended'
};

let gameState = GAME_STATE.RUNNING;
let initialPlayerSize = 30;  // 增大初始大小
let maxPlayerSize = 150;     // 增大最大大小
let growthRate = 0.2;        // 增长速率降低

// 修改移动控制相关变量
const MOVEMENT = {
    KEYBOARD_SPEED: 7,        // 增加速度以适应更大的地图
    MAX_SPEED: 12,           // 增加最大速度
    ACCELERATION: 0.3,       // 保持平滑度
    DECELERATION: 0.95,      // 保持减速度
    ROTATION_SPEED: 0.15,    // 保持旋转速度
    MOUSE_SMOOTHING: 0.15    // 保持鼠标平滑度
};

class Fish {
    constructor(x, y, size, speed, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = speed;
        this.isPlayer = isPlayer;
        this.direction = Math.random() * Math.PI * 2;
        this.lastX = x;
        this.lastY = y;
        this.isDead = false;
        
        if (!isPlayer) {
            const types = Object.keys(FISH_TYPES);
            this.type = FISH_TYPES[types[Math.floor(Math.random() * types.length)]];
            // 根据玩家大小调整NPC鱼的大小
            const playerSizeRatio = player ? (player.size / initialPlayerSize) : 1;
            const minSize = 5 * playerSizeRatio;
            const maxSize = 25 * playerSizeRatio;
            this.size = (minSize + Math.random() * (maxSize - minSize)) * (this.type.sizeMultiplier || 1);
            this.speed *= this.type.speedMultiplier;
        } else {
            this.type = { color: '#FF6B8B' };
        }
        
        // 修改移动相关属性
        this.velocityX = 0;
        this.velocityY = 0;
        this.targetRotation = 0;
        this.currentRotation = 0;
        this.isMoving = false;
        this.keyboardControls = {
            up: false,
            down: false,
            left: false,
            right: false
        };
    }

    // 完全重写键盘移动方法
    updateKeyboardMovement(canvas) {
        if (!this.isPlayer) return;

        let targetDX = 0;
        let targetDY = 0;

        // 计算目标速度
        if (this.keyboardControls.up) targetDY -= MOVEMENT.KEYBOARD_SPEED;
        if (this.keyboardControls.down) targetDY += MOVEMENT.KEYBOARD_SPEED;
        if (this.keyboardControls.left) targetDX -= MOVEMENT.KEYBOARD_SPEED;
        if (this.keyboardControls.right) targetDX += MOVEMENT.KEYBOARD_SPEED;

        // 标准化对角线移动
        if (targetDX !== 0 && targetDY !== 0) {
            const factor = 1 / Math.sqrt(2);
            targetDX *= factor;
            targetDY *= factor;
        }

        // 应用加速度
        if (targetDX !== 0 || targetDY !== 0) {
            this.velocityX += (targetDX - this.velocityX) * MOVEMENT.ACCELERATION;
            this.velocityY += (targetDY - this.velocityY) * MOVEMENT.ACCELERATION;
            this.isMoving = true;
        } else {
            // 应用减速度
            this.velocityX *= MOVEMENT.DECELERATION;
            this.velocityY *= MOVEMENT.DECELERATION;
            if (Math.abs(this.velocityX) < 0.01 && Math.abs(this.velocityY) < 0.01) {
                this.isMoving = false;
            }
        }

        // 限制最大速度
        const currentSpeed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
        if (currentSpeed > MOVEMENT.MAX_SPEED) {
            const factor = MOVEMENT.MAX_SPEED / currentSpeed;
            this.velocityX *= factor;
            this.velocityY *= factor;
        }

        // 更新位置
        const newX = this.x + this.velocityX;
        const newY = this.y + this.velocityY;
        
        // 边界检查
        this.x = Math.max(this.size, Math.min(canvas.width - this.size, newX));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, newY));

        // 更新旋转目标
        if (this.isMoving) {
            this.targetRotation = Math.atan2(this.velocityY, this.velocityX);
        }
    }

    // 优化鼠标移动方法
    updateMouseMovement(targetX, targetY) {
        if (!this.isPlayer) return;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1) {
            // 计算目标速度
            const targetVelocityX = dx * MOVEMENT.MOUSE_SMOOTHING;
            const targetVelocityY = dy * MOVEMENT.MOUSE_SMOOTHING;

            // 平滑过渡到目标速度
            this.velocityX += (targetVelocityX - this.velocityX) * MOVEMENT.ACCELERATION;
            this.velocityY += (targetVelocityY - this.velocityY) * MOVEMENT.ACCELERATION;

            // 更新位置
            this.x += this.velocityX;
            this.y += this.velocityY;

            // 更新旋转
            this.targetRotation = Math.atan2(this.velocityY, this.velocityX);
            this.isMoving = true;
        } else {
            // 停止时的减速
            this.velocityX *= MOVEMENT.DECELERATION;
            this.velocityY *= MOVEMENT.DECELERATION;
            this.isMoving = false;
        }
    }

    // 优化旋转更新
    updateRotation() {
        if (!this.isMoving) return;

        let rotationDiff = this.targetRotation - this.currentRotation;
        
        // 确保选择最短的旋转路径
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

        // 使用 easeOut 效果使旋转更平滑
        this.currentRotation += rotationDiff * MOVEMENT.ROTATION_SPEED;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.isPlayer) {
            ctx.rotate(this.currentRotation + Math.PI);
        } else {
            ctx.rotate(this.direction + Math.PI);
        }

        const bodyColor = this.isPlayer ? '#FF6B6B' : this.type.color;
        
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 2, this.size, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(this.size * 2, 0);
        ctx.lineTo(this.size * 3, -this.size);
        ctx.lineTo(this.size * 3, this.size);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(-this.size, -this.size/2, this.size/4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(-this.size, -this.size/2, this.size/8, 0, Math.PI * 2);
        ctx.fill();
        
        // 添加发光效果
        if (this.isPlayer) {
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 3);
            glow.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
            glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 添加鳍
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(-this.size, -this.size/2);
        ctx.quadraticCurveTo(
            -this.size * 1.5, -this.size,
            -this.size * 0.5, -this.size
        );
        ctx.fill();
        
        // 添加下鳍
        ctx.beginPath();
        ctx.moveTo(-this.size, this.size/2);
        ctx.quadraticCurveTo(
            -this.size * 1.5, this.size,
            -this.size * 0.5, this.size
        );
        ctx.fill();

        ctx.restore();
        
        if (this.isPlayer) {
            this.lastX = this.x;
            this.lastY = this.y;
        }
    }

    move(canvas) {
        if (!this.isPlayer) {
            this.x += Math.cos(this.direction) * this.speed;
            this.y += Math.sin(this.direction) * this.speed;

            if (this.x < 0 || this.x > canvas.width) this.direction = Math.PI - this.direction;
            if (this.y < 0 || this.y > canvas.height) this.direction = -this.direction;
        }
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = new Fish(canvas.width / 2, canvas.height / 2, 20, 5, true);
let fishes = [];
let score = 0;
let gameTime = 0;
let difficultyLevel = 1;

function updateDifficulty() {
    gameTime++;
    if (gameTime % 1000 === 0) {  // 隔一段时间增加难度
        difficultyLevel += 0.2;
    }
}

// 生成小鱼
function spawnFish() {
    if (fishes.length < 30) {  // 增加鱼的数量
        const size = (8 + Math.random() * 22) * difficultyLevel;  // 增加鱼的大小范围
        const speed = (1.5 + Math.random() * 3) * difficultyLevel;  // 增加速度范围
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        fishes.push(new Fish(x, y, size, speed));
    }
}

// 检测碰撞
function checkCollision(fish1, fish2) {
    const dx = fish1.x - fish2.x;
    const dy = fish1.y - fish2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (fish1.size + fish2.size);
}

// 添加暂停按钮和结束按钮
function drawGameControls(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    // 暂停按钮
    ctx.beginPath();
    ctx.roundRect(canvas.width - 100, 20, 80, 30, 5);
    ctx.fill();
    ctx.stroke();
    
    // 结束按钮
    ctx.beginPath();
    ctx.roundRect(canvas.width - 100, 60, 80, 30, 5);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gameState === GAME_STATE.PAUSED ? '继续' : '暂停', canvas.width - 60, 40);
    ctx.fillText('结束', canvas.width - 60, 80);
    ctx.restore();
}

// 修改得分和成长逻辑
function updatePlayerGrowth(eatenFishSize) {
    const growthAmount = (eatenFishSize / player.size) * growthRate;
    const newSize = Math.min(player.size + growthAmount, maxPlayerSize);
    player.size = newSize;
}

// 添加水泡效果
class Bubble {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 10;
        this.size = 2 + Math.random() * 8;
        this.speed = 1 + Math.random() * 2;
        this.alpha = 0.1 + Math.random() * 0.3;
    }

    update() {
        this.y -= this.speed;
        if (this.y < -10) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 创建水泡数组
const bubbles = Array.from({ length: 75 }, () => new Bubble());

// 添加海藻类
class Seaweed {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height;
        this.height = 75 + Math.random() * 150;  // 增加海藻高度
        this.segments = 12;  // 增加段数
        this.time = Math.random() * 1000;
        this.speed = 0.002 + Math.random() * 0.002;
    }

    draw(ctx) {
        this.time += 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        
        for (let i = 0; i < this.segments; i++) {
            const segmentY = this.y - (this.height * i / this.segments);
            const waveMagnitude = 15 * (1 - i / this.segments);
            const offsetX = Math.sin(this.time * this.speed + i * 0.3) * waveMagnitude;
            
            ctx.lineTo(this.x + offsetX, segmentY);
        }
        
        ctx.strokeStyle = '#2ECC71';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// 创建海藻数组
const seaweeds = Array.from({ length: 12 }, () => new Seaweed());

// 修改游戏主循环
function gameLoop() {
    if (gameState === GAME_STATE.RUNNING) {
        // 添加键盘移动更新
        player.updateKeyboardMovement(canvas);
        player.updateRotation();  // 确保旋转更新
    }

    if (gameState === GAME_STATE.PAUSED) {
        // 绘制暂停画面
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏暂停', canvas.width/2, canvas.height/2);
        drawGameControls(ctx);
        requestAnimationFrame(gameLoop);
        return;
    }

    if (player.isDead || gameState === GAME_STATE.ENDED) {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('fishGameHighScore', highScore);
        }
        
        // 绘制游戏结束画面
        ctx.fillStyle = 'rgba(0, 18, 51, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 添加光晕效果
        const gradient = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, 0,
            canvas.width/2, canvas.height/2, 200
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 文字使用更现代的样式
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束!', canvas.width/2, canvas.height/2 - 40);
        
        ctx.font = '24px Arial';
        ctx.fillText(`最终得分: ${score}`, canvas.width/2, canvas.height/2 + 10);
        ctx.fillText(`最高分: ${highScore}`, canvas.width/2, canvas.height/2 + 40);
        
        // 添加闪烁效果的重��提示
        const alpha = 0.5 + 0.5 * Math.sin(Date.now() / 500);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText('点击屏幕重新开始', canvas.width/2, canvas.height/2 + 80);
        
        // 重要继续游戏循环以保持动画效果
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!player.isDead) {
        updateDifficulty();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景效果
    // 绘制海藻
    seaweeds.forEach(seaweed => seaweed.draw(ctx));
    
    // 绘制水泡
    bubbles.forEach(bubble => {
        bubble.update();
        bubble.draw(ctx);
    });
    
    // 添加深度渐变效果
    const depthGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    depthGradient.addColorStop(0, 'rgba(0, 0, 20, 0)');
    depthGradient.addColorStop(1, 'rgba(0, 0, 40, 0.3)');
    ctx.fillStyle = depthGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 继续绘制游戏元素
    player.draw(ctx);
    spawnFish();
    
    fishes.forEach((fish, index) => {
        fish.move(canvas);
        fish.draw(ctx);
        
        if (checkCollision(player, fish)) {
            if (player.size > fish.size) {
                fishes.splice(index, 1);
                updatePlayerGrowth(fish.size);
                score += 10 * (fish.type.scoreMultiplier || 1);
            } else {
                player.isDead = true;
            }
        }
    });
    
    // 显分数、大小和最高分
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${score}`, 20, 35);
    ctx.fillText(`大小: ${Math.floor(player.size)}`, 20, 65);
    ctx.fillText(`最高分: ${highScore}`, 20, 95);
    
    drawGameControls(ctx);
    requestAnimationFrame(gameLoop);
}

// 鼠标控制
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const targetX = e.clientX - rect.left;
    const targetY = e.clientY - rect.top;
    player.updateMouseMovement(targetX, targetY);
});

// 添加键盘控制事件
window.addEventListener('keydown', (e) => {
    if (!player.keyboardControls) return;
    
    switch(e.key) {
        case 'ArrowUp':
            player.keyboardControls.up = true;
            break;
        case 'ArrowDown':
            player.keyboardControls.down = true;
            break;
        case 'ArrowLeft':
            player.keyboardControls.left = true;
            break;
        case 'ArrowRight':
            player.keyboardControls.right = true;
            break;
        case 'Enter':
            // 游戏结束时的重启逻辑
            if (player.isDead || gameState === GAME_STATE.ENDED) {
                gameState = GAME_STATE.RUNNING;
                gameTime = 0;
                difficultyLevel = 1;
                score = 0;
                fishes = [];
                player = new Fish(canvas.width/2, canvas.height/2, initialPlayerSize, 5, true);
                
                if (!window.gameLoopRunning) {
                    window.gameLoopRunning = true;
                    requestAnimationFrame(gameLoop);
                }
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    if (!player.keyboardControls) return;
    
    switch(e.key) {
        case 'ArrowUp':
            player.keyboardControls.up = false;
            break;
        case 'ArrowDown':
            player.keyboardControls.down = false;
            break;
        case 'ArrowLeft':
            player.keyboardControls.left = false;
            break;
        case 'ArrowRight':
            player.keyboardControls.right = false;
            break;
    }
});

// 添加按钮点击处理
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 检查是否点击了控制按钮
    if (x >= canvas.width - 100 && x <= canvas.width - 20) {
        if (y >= 20 && y <= 50) {
            // 暂停/继续按钮
            if (gameState === GAME_STATE.RUNNING) {
                gameState = GAME_STATE.PAUSED;
            } else if (gameState === GAME_STATE.PAUSED) {
                gameState = GAME_STATE.RUNNING;
            }
            return;
        }
        if (y >= 60 && y <= 90) {
            // 结束按钮
            gameState = GAME_STATE.ENDED;
            player.isDead = true;
            return;
        }
    }
    
    // 游戏结束时的重启逻辑
    if ((player.isDead || gameState === GAME_STATE.ENDED) && 
        !(x >= canvas.width - 100 && x <= canvas.width - 20 && y >= 20 && y <= 90)) {
        
        // 重置所有游戏态
        gameState = GAME_STATE.RUNNING;
        gameTime = 0;
        difficultyLevel = 1;
        score = 0;
        fishes = [];
        player = new Fish(canvas.width/2, canvas.height/2, initialPlayerSize, 5, true);
        
        // 确保游戏循环在重启时正确运行
        if (!window.gameLoopRunning) {
            window.gameLoopRunning = true;
            requestAnimationFrame(gameLoop);
        }
    }
});

// 添加一个标志来跟踪游戏循环是否正在运行
window.gameLoopRunning = true;

// 启动游戏
gameLoop(); 