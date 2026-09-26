0  BEGIN PGM face MM 
1  BLK FORM 0.1 Z  X+0  Y-60  Z-20
2  BLK FORM 0.2  X+490  Y+0  Z+0
3  ;-------------------------------------
4  ;Tools
5  ;  #23 D=80 - ZMIN=-0.5 - ZMAX=+15 - face mill
6  ;-------------------------------------
7  ;
8  * - Face1 (3)
9  M5
10 TOOL CALL 23 Z S800
11 L M140 MB MAX
12 M3
13 LBL 1
14 CYCL DEF 247 DATUM SETTING ~
    Q339=+1    ;DATUM NUMBER
15 LBL 0
16 L  X-52  Y-30 R0 FMAX
17 L  Z+15 R0 FMAX
18 M8
19 CYCL DEF 32.0 TOLERANCE
20 CYCL DEF 32.1
21 L  Z+7.5 FMAX
22 CC  X-44  Z+7.5
23 CP IPA-90 DR- F2800
24 L  X-40.01  Z-0.5
25 L  X+540.01
26 CC  X+540.01  Z+7.5
27 CP IPA-90 DR-
28 L  X+548.01  Z+15 FMAX
29 M9
30 M5
31 L M140 MB MAX
32 M30
33 END PGM face MM 
