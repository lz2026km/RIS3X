export const DEPLOY_VERSION = '3.0.7.0';

export interface DeployConfig {
  environment: 'development' | 'staging' | 'production';
  replicas: number;
  dockerImageTag: string;
  registry: string;
  namespace: string;
  helmReleaseName: string;
}

export function getDefaultDeployConfig(env: DeployConfig['environment'] = 'development'): DeployConfig {
  return {
    environment: env,
    replicas: env === 'production' ? 3 : 1,
    dockerImageTag: `g005/ris:${DEPLOY_VERSION}`,
    registry: 'docker.io',
    namespace: `g005-${env}`,
    helmReleaseName: 'g005-ris',
  };
}

export function validateDeployConfig(config: DeployConfig): string[] {
  const errors: string[] = [];
  if (config.replicas < 1) errors.push('Replicas must be >= 1');
  if (config.replicas > 20) errors.push('Replicas must be <= 20');
  return errors;
}
