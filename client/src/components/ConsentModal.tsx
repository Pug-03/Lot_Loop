import { useState } from "react";
import { useTranslation } from "react-i18next";

type Props = { onAccept: () => void };

export default function ConsentModal({ onAccept }: Props) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);

  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-modal="true">
        <h3>การเก็บข้อมูลส่วนบุคคล (Consent)</h3>
        <div className="note" style={{ whiteSpace: "pre-wrap" }}>
          {`ระบบนี้จะเก็บข้อมูลจากบัตรประชาชน เช่น หมายเลขบัตรประชาชน ชื่อ-นามสกุล และข้อมูลการสแกนใบหน้าเพื่อยืนยันตัวตนและให้บริการการซื้อสลากตามกฎหมายที่เกี่ยวข้อง เช่น พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)

ผู้ใช้ต้องยอมรับการเก็บ ใช้ และเปิดเผยข้อมูลตามวัตถุประสงค์ข้างต้นก่อนใช้งานเครื่องนี้`}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>ฉันยอมรับการเก็บและการใช้ข้อมูลส่วนบุคคลตามที่ระบุไว้</span>
        </label>
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => { /* no-op; require acceptance */ }}>
            ยกเลิก
          </button>
          <button className="btn" onClick={() => { if (checked) onAccept(); }} disabled={!checked}>
            ยอมรับและดำเนินการต่อ
          </button>
        </div>
      </div>
    </div>
  );
}
