import streamDeck from "@elgato/streamdeck";
import { spawn } from "node:child_process";

import { LOGIN_URL, normalizeToken } from "./api/rat-token";

/**
 * Windows Forms dialog asking for a new `rat` cookie, written to stdout when validated. Run through PowerShell, which
 * the plugin already relies on for sounds.
 */
const DIALOG_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "Sea of Thieves - Connexion au profil"
$form.ClientSize = New-Object System.Drawing.Size(540, 250)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$info = New-Object System.Windows.Forms.Label
$info.SetBounds(16, 12, 508, 104)
$info.Text = "La session seaofthieves.com a expiré. Pour la renouveler :" + [Environment]::NewLine +
	"1. Ouvre ton profil sur seaofthieves.com et connecte-toi." + [Environment]::NewLine +
	"2. Appuie sur F12, onglet Application, Cookies, www.seaofthieves.com." + [Environment]::NewLine +
	"3. Copie la valeur du cookie « rat » et colle-la ci-dessous."
$form.Controls.Add($info)

$link = New-Object System.Windows.Forms.LinkLabel
$link.SetBounds(16, 118, 300, 22)
$link.Text = "Ouvrir seaofthieves.com"
$link.add_LinkClicked({ Start-Process "${LOGIN_URL}" })
$form.Controls.Add($link)

$token = New-Object System.Windows.Forms.TextBox
$token.SetBounds(16, 150, 508, 28)
$token.UseSystemPasswordChar = $true
$form.Controls.Add($token)

$ok = New-Object System.Windows.Forms.Button
$ok.SetBounds(332, 200, 92, 32)
$ok.Text = "Valider"
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($ok)
$form.AcceptButton = $ok

$cancel = New-Object System.Windows.Forms.Button
$cancel.SetBounds(432, 200, 92, 32)
$cancel.Text = "Annuler"
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancel)
$form.CancelButton = $cancel

$form.Add_Shown({ $form.Activate(); $token.Focus() })
if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
	[Console]::Out.Write($token.Text)
}
`;

let open: Promise<string | undefined> | undefined;

/**
 * Shows the dialog and resolves with the token entered, or `undefined` if cancelled. Only one dialog is open at a time.
 */
export function promptForToken(): Promise<string | undefined> {
	if (process.platform !== "win32") {
		return Promise.resolve(undefined);
	}

	open ??= new Promise<string | undefined>((resolve) => {
		// -EncodedCommand (UTF-16LE base64) avoids any quoting issue with the script.
		const encoded = Buffer.from(DIALOG_SCRIPT, "utf16le").toString("base64");
		const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", encoded], {
			stdio: ["ignore", "pipe", "ignore"],
			windowsHide: true,
		});
		let output = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => (output += chunk));
		child.on("error", (error) => {
			streamDeck.logger.warn(`Cannot open the token dialog: ${error.message}`);
			resolve(undefined);
		});
		child.on("close", () => resolve(normalizeToken(output)));
	}).finally(() => (open = undefined));

	return open;
}
