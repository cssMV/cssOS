# cssOS Auto Sync Rollback

If you need to immediately stop all automations and return to manual flow:

## 1) Disable and stop services/timers

```bash
sudo systemctl disable --now cssos-media-sync.path cssos-media-sync.service
sudo systemctl disable --now cssos-git-autosave.timer cssos-git-autosave.service
```

## 2) Verify all units are inactive

```bash
systemctl status cssos-media-sync.path cssos-media-sync.service cssos-git-autosave.timer cssos-git-autosave.service
```

## 3) Optional: remove installed unit files

```bash
sudo rm -f /etc/systemd/system/cssos-media-sync.path
sudo rm -f /etc/systemd/system/cssos-media-sync.service
sudo rm -f /etc/systemd/system/cssos-git-autosave.timer
sudo rm -f /etc/systemd/system/cssos-git-autosave.service
sudo systemctl daemon-reload
```

## 4) Keep scripts for manual use

You can still run:

```bash
sudo /home/jing/cssOS/repo/scripts/ops/cssos-media-sync.sh
/home/jing/cssOS/repo/scripts/ops/cssos-git-autosave.sh
```
