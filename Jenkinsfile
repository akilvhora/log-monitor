pipeline {
    agent any

    environment {
        REGISTRY      = 'server:8082'
        IMAGE_API     = "${REGISTRY}/log-monitor-api"
        IMAGE_WEB     = "${REGISTRY}/log-monitor-web"
        IMAGE_TAG     = "${env.BUILD_NUMBER}"
        REGISTRY_CRED = 'nexus-docker-creds'   // Jenkins credential ID
    }

    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "Building branch: ${env.BRANCH_NAME ?: 'main'} — build #${env.BUILD_NUMBER}"
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('API Image') {
                    steps {
                        script {
                            docker.build("${IMAGE_API}:${IMAGE_TAG}", '-f docker/Dockerfile.api .')
                        }
                    }
                }
                stage('Web Image') {
                    steps {
                        script {
                            docker.build("${IMAGE_WEB}:${IMAGE_TAG}", '-f docker/Dockerfile.web .')
                        }
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                script {
                    docker.withRegistry("http://${REGISTRY}", REGISTRY_CRED) {
                        docker.image("${IMAGE_API}:${IMAGE_TAG}").push()
                        docker.image("${IMAGE_API}:${IMAGE_TAG}").push('latest')

                        docker.image("${IMAGE_WEB}:${IMAGE_TAG}").push()
                        docker.image("${IMAGE_WEB}:${IMAGE_TAG}").push('latest')
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                echo "Deploying build #${IMAGE_TAG} — update your docker-compose or k8s manifests here."
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
            // Clean up local images to reclaim disk space
            script {
                if (isUnix()) {
                    sh """
                        docker rmi ${IMAGE_API}:${IMAGE_TAG} || true
                        docker rmi ${IMAGE_WEB}:${IMAGE_TAG} || true
                    """
                } else {
                    bat """
                        docker rmi ${IMAGE_API}:${IMAGE_TAG} || exit 0
                        docker rmi ${IMAGE_WEB}:${IMAGE_TAG} || exit 0
                    """
                }
            }
        }
    }
}
