import http from 'node:http';

const options = {
  hostname: '192.168.1.111',
  port: 8081,
  path: '/service/rest/v1/repositories/docker',
  headers: {
    Authorization: 'Basic ' + Buffer.from('admin:admin@123').toString('base64'),
  },
};

http.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => console.log(data));
}).on('error', (err) => console.error('Error:', err.message));
