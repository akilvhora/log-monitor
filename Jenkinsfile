pipeline {
    agent any

    environment {
        REGISTRY        = 'server:8081'
        IMAGE_API       = "${REGISTRY}/log-monitor-api"
        IMAGE_WEB       = "${REGISTRY}/log-monitor-web"
        IMAGE_TAG       = "${env.BUILD_NUMBER}"
        REGISTRY_CRED   = 'nexus-docker-creds'
        DOCKER_BUILDKIT = '1'
        REPO_URL        = 'https://github.com/akilvhora/log-monitor.git'
        REPO_BRANCH     = 'master'
    }

    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                // Apply git settings inline so they take effect regardless of the
                // server-level .gitconfig.  Then clone with retry to survive
                // transient network drops.
                retry(3) {
                    bat """
                        git config --global http.sslBackend  openssl
                        git config --global http.version     HTTP/1.1
                        git config --global http.postBuffer  524288000
                        git config --global core.compression 0
                        git config --global http.sslVerify   true
                        git config --global --add safe.directory "%CD%"

                        IF EXIST .git (
                            git fetch --depth=1 origin %REPO_BRANCH%
                            git reset --hard origin/%REPO_BRANCH%
                            git clean -fd
                        ) ELSE (
                            git clone --depth=1 --no-tags --single-branch --branch %REPO_BRANCH% %REPO_URL% .
                        )
                    """
                }
                echo "Checked out branch: ${env.REPO_BRANCH} -- build #${env.BUILD_NUMBER}"
            }
        }

        stage('Pull Base Images') {
            // Pull base images separately with retry before the build.
            // Avoids mid-layer TLS bad-record-MAC failures by isolating the
            // network-heavy step and retrying on transient drops.
            steps {
                retry(3) {
                    bat "docker pull node:20-alpine"
                }
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('API Image') {
                    steps {
                        retry(2) {
                            bat "docker build --no-cache -f docker/Dockerfile.api -t %IMAGE_API%:%IMAGE_TAG% ."
                        }
                    }
                }
                stage('Web Image') {
                    steps {
                        retry(2) {
                            bat "docker build --no-cache -f docker/Dockerfile.web -t %IMAGE_WEB%:%IMAGE_TAG% ."
                        }
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                withCredentials([usernamePassword(credentialsId: "${REGISTRY_CRED}", usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                    bat """
                        docker login %REGISTRY% -u %REG_USER% -p %REG_PASS%
                        docker push %IMAGE_API%:%IMAGE_TAG%
                        docker tag  %IMAGE_API%:%IMAGE_TAG% %IMAGE_API%:latest
                        docker push %IMAGE_API%:latest
                        docker push %IMAGE_WEB%:%IMAGE_TAG%
                        docker tag  %IMAGE_WEB%:%IMAGE_TAG% %IMAGE_WEB%:latest
                        docker push %IMAGE_WEB%:latest
                    """
                }
            }
        }

        stage('Deploy') {
            when {
                // branch 'master' / branch 'main' only work in Multibranch
                // Pipelines (they read env.BRANCH_NAME).  This is a regular
                // Pipeline that does its own checkout, so use REPO_BRANCH.
                anyOf {
                    expression { env.REPO_BRANCH == 'master' }
                    expression { env.REPO_BRANCH == 'main'   }
                }
            }
            steps {
                echo "Deploying build #${IMAGE_TAG} -- update your docker-compose or k8s manifests here."
            }
        }
    }

    post {
        success {
            echo "Build ${BUILD_NUMBER} succeeded. Images pushed to ${REGISTRY}."
        }
        failure {
            echo "Build ${BUILD_NUMBER} failed."
        }
        always {
            bat """
                docker rmi %IMAGE_API%:%IMAGE_TAG% 2>nul
                docker rmi %IMAGE_WEB%:%IMAGE_TAG% 2>nul
                docker rmi %IMAGE_API%:latest 2>nul
                docker rmi %IMAGE_WEB%:latest 2>nul
                exit 0
            """
        }
    }
}
