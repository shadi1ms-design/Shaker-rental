import React from 'react';
import { useMfaEnrollment } from '../../hooks/useMfaEnrollment';
import { ChangePasswordCard } from './ChangePasswordCard';
import { MfaSecurityCard } from './MfaSecurityCard';

export type MfaEnrollmentState = ReturnType<typeof useMfaEnrollment>;

export interface SecurityTabProps {
  showMfaCard: boolean;
  canEditCredentials: boolean;
  mfa: MfaEnrollmentState;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
  showMfaCard,
  canEditCredentials,
  mfa,
}) => {
  return (
    <div className="space-y-4">
      <ChangePasswordCard
        canEditCredentials={canEditCredentials}
        currentPassword={mfa.currentPassword}
        onCurrentPasswordChange={mfa.setCurrentPassword}
        newPassword={mfa.newPassword}
        onNewPasswordChange={mfa.setNewPassword}
        confirmPassword={mfa.confirmPassword}
        onConfirmPasswordChange={mfa.setConfirmPassword}
        isChangingPassword={mfa.isChangingPassword}
        passwordFeedback={mfa.passwordFeedback}
        onSubmit={mfa.handleChangePasswordSubmit}
      />
      {showMfaCard && (
        <MfaSecurityCard
          isMfaEnrolled={mfa.isMfaEnrolled}
          isEmailVerifiedForMfa={mfa.isEmailVerifiedForMfa}
          hasPasswordProvider={mfa.hasPasswordProvider}
          hasGoogleProvider={mfa.hasGoogleProvider}
          mfaStep={mfa.mfaStep}
          setMfaStep={mfa.setMfaStep}
          mfaReauthPassword={mfa.mfaReauthPassword}
          setMfaReauthPassword={mfa.setMfaReauthPassword}
          totpQrSvg={mfa.totpQrSvg}
          totpSecretKey={mfa.totpSecretKey}
          totpCode={mfa.totpCode}
          setTotpCode={mfa.setTotpCode}
          mfaLoading={mfa.mfaLoading}
          mfaFeedback={mfa.mfaFeedback}
          setMfaFeedback={mfa.setMfaFeedback}
          secretCopied={mfa.secretCopied}
          onCopySecret={mfa.handleCopySecret}
          onStartMfaEnrollment={mfa.handleStartMfaEnrollment}
          onConfirmMfaEnrollment={mfa.handleConfirmMfaEnrollment}
          onCancelMfaEnrollment={mfa.handleCancelMfaEnrollment}
          onInitiateMfaUnenroll={mfa.handleInitiateMfaUnenroll}
          onConfirmMfaUnenroll={mfa.handleConfirmMfaUnenroll}
          showAdminUnenrollWarning={mfa.showAdminUnenrollWarning}
          onConfirmAdminUnenrollWarning={mfa.handleConfirmAdminUnenrollWarning}
          onCancelAdminUnenrollWarning={mfa.handleCancelAdminUnenrollWarning}
        />
      )}
    </div>
  );
};

