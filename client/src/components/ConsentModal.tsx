type Props = { onAccept: () => void };

export default function ConsentModal({ onAccept }: Props) {
  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-modal="true">
        <h3>การเก็บข้อมูลส่วนบุคคล (Consent)</h3>
        <div className="note" style={{ whiteSpace: "pre-wrap" }}>
          {`ระบบนี้จะเก็บข้อมูลจากบัตรประชาชน เช่น หมายเลขบัตรประชาชน ชื่อ-นามสกุล และข้อมูลการสแกนใบหน้าเพื่อยืนยันตัวตนและให้บริการการซื้อสลากตามกฎหมายที่เกี่ยวข้อง เช่น พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)

ผู้ใช้ต้องยอมรับการเก็บ ใช้ และเปิดเผยข้อมูลตามวัตถุประสงค์ข้างต้นก่อนใช้งานเครื่องนี้`}
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onAccept}>
            ยอมรับและดำเนินการต่อ
          </button>
        </div>
      </div>
    </div>
  );
}
