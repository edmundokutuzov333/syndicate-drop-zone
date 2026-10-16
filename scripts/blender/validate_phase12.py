#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import argv_after_dashes
from phase12_lightmaps import validate
def main():
 a=argv_after_dashes();r=validate(a[0] if a else "art/out/phase12-mesh-areas.json",a[1] if len(a)>1 else "art/xoyens-studio.phase12.report.json")
 if r["status"]!="source-validated":raise SystemExit(1)
if __name__=="__main__":main()
