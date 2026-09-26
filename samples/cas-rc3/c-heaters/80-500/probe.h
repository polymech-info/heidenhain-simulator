0  BEGIN PGM probe MM 
1  BLK FORM 0.1 Z  X+0  Y-80  Z-20
2  BLK FORM 0.2  X+60  Y+0  Z+0
3  ;-------------------------------------
4  ;Tools
5  ;  #100 D=6 CR=3 - ZMIN=+0 - ZMAX=+55 - probe
6  ;    Heidenhain
7  ;-------------------------------------
8  ;
9  * - Probe WCS1 (3)
10 M5
11 TOOL CALL 100 Z S50
12 L M140 MB MAX
13 L  X+12.075  Y-40 R0 FMAX
14 L  Z+55 R0 FMAX
15 CYCL DEF 32.0 TOLERANCE
16 CYCL DEF 32.1
17 TCH PROBE 417 DATUM IN TS AXIS ~
    Q263=+12.075 ;1ST POINT 1ST AXIS ~
    Q264=-40   ;1ST POINT 2ND AXIS ~
    Q294=+0    ;1ST POINT 3RD AXIS ~
    Q320=+12   ;SET-UP CLEARANCE ~
    Q260=+5    ;CLEARANCE HEIGHT ~
    Q305=+0    ;NUMBER IN TABLE ~
    Q333=+0    ;DATUM ~
    Q303=+1    ;MEAS. VALUE TRANSFER
18 L  Z+55 FMAX
19 M5
20 L M140 MB MAX
21 M30
22 END PGM probe MM 
