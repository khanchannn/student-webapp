# Sử dụng image Node chính thức
FROM node:20

# Đặt thư mục làm việc trong container
WORKDIR /app

# Copy toàn bộ file cần thiết
COPY package*.json ./
RUN npm install --production

COPY . .

# Cổng ứng dụng NodeJS
EXPOSE 3000

# Lệnh khởi chạy app
CMD ["node", "script.js"]
