export function ControlPanel() {
  return (
    <section className="panel control-panel">
      <h2>Controls</h2>
      <label className="control-field">
        <span>Parameter A</span>
        <input type="range" min="0" max="100" defaultValue="50" />
      </label>
      <label className="control-field">
        <span>Parameter B</span>
        <input type="range" min="0" max="100" defaultValue="25" />
      </label>
      <p className="panel-note"></p>
    </section>
  )
}
