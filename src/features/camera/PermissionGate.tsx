export function PermissionGate() {
  return (
    <div className="camera-permission-gate">
      <span className="camera-permission-code">DEVICE INPUT STANDBY</span>
      <p>Camera e microfone não são activados automaticamente.</p>
      <small>A permissão será pedida apenas por uma acção explícita.</small>
    </div>
  );
}
