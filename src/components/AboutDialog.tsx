import { APP_NAME } from "../constants";
import type { AppTranslations } from "../i18n";

import { Modal } from "./Modal";

type AboutDialogProps = {
  appVersion: string;
  translations: AppTranslations["about"];
  onClose: () => void;
};

export function AboutDialog({
  appVersion,
  translations,
  onClose,
}: AboutDialogProps) {
  return (
    <Modal
      footer={
        <button className="app-modal-btn" onClick={onClose} type="button">
          {translations.confirm}
        </button>
      }
      onRequestClose={onClose}
      title={translations.title}
    >
      <h2 className="app-modal-app-name">{APP_NAME}</h2>
      <p className="app-modal-version">{translations.version(appVersion)}</p>
      <p className="app-modal-description">{translations.description}</p>
    </Modal>
  );
}
