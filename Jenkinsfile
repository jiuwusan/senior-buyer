pipeline {
    agent any

    environment {
        NODE_HOME = tool 'NodeJS 22.14.0'
        PATH = "${NODE_HOME}/bin:${PATH}"
        
        REMOTE_USER = 'root'
        REMOTE_HOST = '10.10.0.139'
        // 定义基础路径，方便后续拼写
        BASE_PATH = '/data/workspace/pm2/services'
    }

    // triggers {
    //     pollSCM('H/15 * * * *')
    // }

    stages {
        stage('Checkout') {
            steps {
                git credentialsId: 'ali_codeup_jiuwusaan_token', 
                    url: 'https://codeup.aliyun.com/63988bc9aa32314b151ed2b3/jiuwusan/senior-buyer.git', 
                    branch: 'master'
            }
        }

        stage('Remote Deploy') {
            steps {
                sshagent(['centos7_ssh_private_key']) {
                    sh '''
                    echo "正在部署..."
                    ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${BASE_PATH}/senior-buyer"
                    
                    # 推送
                    scp -r ./weidian ./youzan ${REMOTE_USER}@${REMOTE_HOST}:${BASE_PATH}/senior-buyer/

                    # 重启服务 (PM2 容器内)
                    ssh ${REMOTE_USER}@${REMOTE_HOST} "
                        docker exec pm2 sh -c 'cd /app/services/senior-buyer/weidian/weidian-api && yarn install --production'
                        docker exec pm2 sh -c 'cd /app/services/senior-buyer/youzan/youzan-api && yarn install --production'
                        docker exec pm2 sh -c 'pm2 restart weidian-api'
                        docker exec pm2 sh -c 'pm2 restart youzan-api'
                    "
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '🚀 部署成功！前后端服务已更新并重启。'
        }
        failure {
            echo '❌ 部署失败，请检查控制台日志。'
        }
    }
}