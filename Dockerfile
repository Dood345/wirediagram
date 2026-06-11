FROM nginx:alpine

# Copy static web assets into default Nginx folder
COPY . /usr/share/nginx/html

EXPOSE 80
