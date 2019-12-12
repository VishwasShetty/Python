#Auther:Vishwas Shetty
#Programming Language:Python
#Progarm:To Create Tic Tak Toe game
#Start Date:4-12-2019
#End Date:6-12-2019


import tkinter
from tkinter.ttk import *
import winsound
from tkinter import *
from tkinter import messagebox
from winsound import*
flag1=0
flag2=0
flag3=0
flag4=0
flag5=0
flag6=0
flag7=0
flag8=0
flag9=0
player="A" 
button=0
value1=""
value2=""
value3=""
value4=""
value5=""
value6=""
value7=""
value8=""
value9=""
playerAcount=0
playerBcount=0
countA=[]
countB=[]
def button_clicked(n):
    global button
    global countA
    global countB
    global value1
    global value2
    global value3
    global value4
    global value5
    global value6
    global value7
    global value8
    global value9
    global player
    global playerAcount
    global playerBcount
    global flag1
    global flag2
    global flag3
    global flag4
    global flag5
    global flag6
    global flag7
    global flag8
    global flag9
    button=n
    #button 1 clicked
    if button==1:
        if flag1==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(1)
                flag1=1
                if playerAcount>=3:
                    value1="X"
                    val1.set(value1)
                    result(player,countA)        
                else:
                    value1="X"
                    val1.set(value1)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":                
                playerBcount=playerBcount+1
                countB.append(1)
                flag1=1
                if playerBcount>=3:
                    value1="O"
                    val1.set(value1)
                    result(player,countB)    
                else:
                    value1="O"
                    val1.set(value1)
                    player="A"
                    players.set("Player "+player)
        else:
             PlaySound('Sound.wav',SND_FILENAME)          
    #button2 clicked            
    if button==2:
        if flag2==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(2)
                flag2=1
                if playerAcount>=3:
                    value2="X"
                    val2.set(value2)
                    result(player,countA)
                else:
                    value2="X"
                    val2.set(value2)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(2)
                flag2=1
                if playerBcount>=3:
                    value2="O"
                    val2.set(value2)
                    result(player,countB)
                else:
                    value2="O"
                    val2.set(value2)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
    if button==3:
        if flag3==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(3)
                flag3=1
                if playerAcount>=3:
                    value3="X"
                    val3.set(value3)
                    result(player,countA)
                else:
                    value3="X"
                    val3.set(value3)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(3)
                flag3=1
                if playerBcount>=3:
                    value3="O"
                    val3.set(value3)
                    result(player,countB)
                else:
                    value3="O"
                    val3.set(value3)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
    if button==4:
        if flag4==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(4)
                flag4=1
                if playerAcount>=3:
                    value4="X"
                    val4.set(value4)
                    result(player,countA) 
                else:
                    value4="X"
                    val4.set(value4)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(4)
                flag4=1
                if playerBcount>=3:
                    value4="O"
                    val4.set(value4)
                    result(player,countB)
                else:
                    value4="O"
                    val4.set(value4)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
    if button==5:
        if flag5==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(5)
                flag5=1
                if playerAcount>=3:
                    value5="X"
                    val5.set(value5)
                    result(player,countA)
                else:
                    value5="X"
                    val5.set(value5)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(5)
                flag5=1
                if playerBcount>=3:
                    value5="O"
                    val5.set(value5)
                    result(player,countB)
                else:
                    value5="O"
                    val5.set(value5)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
    if button==6:
        if flag6==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(6)
                flag6=1
                if playerAcount>=3:
                    value6="X"
                    val6.set(value6)
                    result(player,countA)
                else:
                    value6="X"
                    val6.set(value6)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(6)
                flag6=1
                if playerBcount>=3:
                    value6="O"
                    val6.set(value6)
                    result(player,countB)
                else:
                    value6="O"
                    val6.set(value6)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
    if button==7:
        if flag7==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(7)
                flag7=1
                if playerAcount>=3:
                    value7="X"
                    val7.set(value7)
                    result(player,countA)
                else:
                    value7="X"
                    val7.set(value7)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(7)
                flag7=1
                if playerBcount>=3:
                    value7="O"
                    val7.set(value7)
                    result(player,countB)
                else:
                    value7="O"
                    val7.set(value7)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
    #button8 is clicked
    if button==8:
        if flag8==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(8)
                flag8=1
                if playerAcount>=3:
                    value8="X"
                    val8.set(value8)
                    result(player,countA)                 
                else:
                    value8="X"
                    val8.set(value8)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(8)
                flag8=1
                if playerBcount>=3:
                    value8="O"
                    val8.set(value8)
                    result(player,countB)
                else:
                    value8="O"
                    val8.set(value8)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 
  #button9 is clicked
    if button==9:
        if flag9==0:
            if player=="A":
                playerAcount=playerAcount+1
                countA.append(9)
                flag9=1
                if playerAcount>=3:
                    value9="X"
                    val9.set(value9)
                    result(player,countA) 
                else:
                    value9="X"
                    val9.set(value9)
                    player="B"
                    players.set("Player "+player)
            elif player=="B":
                playerBcount=playerBcount+1
                countB.append(9)
                flag9=1
                if playerBcount>=3:
                    value9="O"
                    val9.set(value9)
                    result(player,countB) 
                else:
                    value9="O"
                    val9.set(value9)
                    player="A"
                    players.set("Player "+player)
        else:
            PlaySound('Sound.wav',SND_FILENAME) 

#function for checking combination
def result(playerr,cnt):
    global player
    if len(cnt)>3:
       count2= delete_addition_ele(cnt)
    else:
        count=cnt
        count1=sorted(count)
        s=[str(i) for i in count1]
        count2=int("".join(s))
    #if len(count) ==3:
    if playerr=="A":
        if count2==123 or count2==456 or count2==789 or count2==147 or count2==258 or count2==369 or count2==159 or count2==357 :
            messagebox.showinfo("Result","Player A is Winner")
            clear()
        else:
            player="B"
            players.set("Player "+player)
    elif playerr=="B":
        if count2==123 or count2==456 or count2==789 or count2==147 or count2==258 or count2==369 or count2==159 or count2==357 :
            messagebox.showinfo("Result","Player B is Winner")
            clear()
        else:
            player="A"
            players.set("Player "+player)
        
       
#function for clearing playboard    
def clear():
    global player
    global playerAcount
    global playerBcount
    global countA
    global countB
    global flag1
    global flag2
    global flag3
    global flag4
    global flag5
    global flag6
    global flag7
    global flag8
    global flag9
    player="A"
    players.set("Player "+player)
    playerAcount=0
    playerBcount=0 
    val1.set("")
    val2.set("")
    val3.set("")
    val4.set("")
    val5.set("")
    val6.set("")
    val7.set("")
    val8.set("")
    val9.set("")
    value1=""
    value2=""
    value3=""
    value4=""
    value5=""
    value6=""
    value7=""
    value8=""
    value9=""
    countA=[]
    countB=[]
    flag1=0
    flag2=0
    flag3=0
    flag4=0
    flag5=0
    flag6=0
    flag7=0
    flag8=0
    flag9=0
#function for deleting addintional element
def delete_addition_ele(c):
    global player
    cnt=sorted(c)
    if len(cnt)==4:
        s=[str(i) for i in cnt]
        count=int("".join(s))
        if count==1234 or count==1235 or count==1236 or count==1237 or count==1238 or count==1239:
            return 123
        elif count==1456 or count==2456 or count==3456 or count==4567 or count==4568 or count==4569:
            return 456
        elif count==1789 or count==2789 or count==3789 or count==4789 or count==5789 or count==6789:
            return 789
        elif count==1247 or count==1347 or count==1457 or count==1467 or count==1478 or count==1479:
            return 147
        elif count==1258 or count==2358 or count==2458 or count==2568 or count==2578 or count==2589:
            return 258
        elif count==1369 or count==2369 or count==3469 or count==3569 or count==3679 or count==3689:
            return 369
        elif count==1259 or count==1359 or count==1459 or count==1569 or count==1579 or count==1589:
            return 159
        elif count==1357 or count==2357 or count==3457 or count==3567 or count==3578 or count==3579:
            return 357
    elif len(cnt)==5:
        s=[str(i) for i in cnt]
        count=int("".join(s))
        if count==12345 or count==12346 or count==12347 or count==12348 or count==12349 or count==12356 or count==12357 or count==12358 or count==12359 or count==12367 or count==12368 or count==12369 or count==12378 or count==12379 or count==12389:
            return 123
        elif count==12456 or count==13456 or count==14567 or count==14568 or count==14569 or count==23456 or count==24567 or count==24568 or count==24569 or count==34567 or count==34568 or count==34569 or count==45678 or count==45679 or count==45689:
            return 456
        elif count==12789 or count==13789 or count==14789 or count==15789 or count==16789 or count==23789 or count==24789 or count==25789 or count==26789 or count==34789 or count==35789 or count==36789 or count==45789 or count==46789 or count==56789:
            return 789
        elif count==12347 or count==12457 or count==12467 or count==12478 or count==12479 or count==13457 or count==13467 or count==13478 or count==13479 or count==14567 or count==14578 or count==14579 or count==14678 or count==14679 or count==14789:
            return 147
        elif count==12358 or count==12458 or count==12568 or count==12578 or count==12589 or count==23458 or count==23568 or count==23578 or count==23589 or count==24568 or count==24578 or count==24589 or count==25678 or count==25689 or count==25789:
            return 258
        elif count==12369 or count==13469 or count==13569 or count==13679 or count==13689 or count==23469 or count==23569 or count==23679 or count==23689 or count==34569 or count==34679 or count==34689 or count==35679 or count==35689 or count==36789:
            return 369
        elif count==12359 or count==12459 or count==12569 or count==12579 or count==12589 or count==13459 or count==13569 or count==13579 or count==13589 or count==14569 or count==14579 or count==14589 or count==15679 or count==15689 or count==15789:
            return 159
        elif count==12357 or count==13457 or count==13567 or count==13578 or count==13579 or count==23457 or count==23567 or count==23578 or count==23579 or count==34567 or count==34578 or count==34579 or count==35678 or count==35679 or count==35789:
            return 357
        else:
            messagebox.showinfo("Result","Match is Tie")
            clear()

    
root=tkinter.Tk()
root.geometry("250x400+300+300")
root.resizable(10,10)
root.title("tic tak toi")
val1=StringVar()
val2=StringVar()
val3=StringVar()
val4=StringVar()
val5=StringVar()
val6=StringVar()
val7=StringVar()
val8=StringVar()
val9=StringVar()
players=StringVar()

players.set("Player "+player)
btnrow0=Frame(root)
btnrow0.pack(expand=True,fill="both")

btnrow1=Frame(root,bg="blue")
btnrow1.pack(expand=True,fill="both")

btnrow2=Frame(root,bg="green")
btnrow2.pack(expand=True,fill="both")

btnrow3=Frame(root,bg="yellow")
btnrow3.pack( expand=True,fill="both" )

btnrow4=Frame(root)
btnrow4.pack(expand=True,fill="both")

btnrow5=Frame(root)
btnrow5.pack(expand=True,fill="both")


label2=Label(
    btnrow0,
    text="Label",
    anchor=SE,
    font=("verdana",20),
   textvariable=players,
)
label2.pack(expand=True,side=LEFT,fill="both")
btn1=Button(
    btnrow1,
    text="",
    font=("verdana",22),
    textvariable=val1,
    command=lambda:button_clicked(1),
    
)
btn1.pack(expan=True,side=LEFT,fill="both")

btn2=Button(
    btnrow1,
    text="",
    font=("verdana",22),
    textvariable=val2,
    command=lambda:button_clicked(2),
    
)
btn2.pack(expan=True,side=LEFT,fill="both")
btn3=Button(
    btnrow1,
    text="",
    font=("verdana",22),
    textvariable=val3,
    command=lambda:button_clicked(3),
)
btn3.pack(expan=True,side=LEFT,fill="both")

#btnrow2 buttons
btn4=Button(
    btnrow2,
    text="",
    font=("verdana",22),
    textvariable=val4,
    command=lambda:button_clicked(4),
    
)
btn4.pack(expan=True,side=LEFT,fill="both")

btn5=Button(
    btnrow2,
    text="",
    font=("verdana",22),
    textvariable=val5,
    command=lambda:button_clicked(5),
    
)
btn5.pack(expan=True,side=LEFT,fill="both")
btn6=Button(
    btnrow2,
    text="",
    font=("verdana",22),
    textvariable=val6,
    command=lambda:button_clicked(6),
)
btn6.pack(expan=True,side=LEFT,fill="both")

#btnrow3 buttons
btn7=Button(
    btnrow3,
    text="",
    font=("verdana",22),
    textvariable=val7,
    command=lambda:button_clicked(7),
    
)
btn7.pack(expan=True,side=LEFT,fill="both")

btn8=Button(
    btnrow3,
    text="",
    font=("verdana",22),
    textvariable=val8,
    command=lambda:button_clicked(8),
    
)
btn8.pack(expan=True,side=LEFT,fill="both")
btn9=Button(
    btnrow3,
    text="",
    font=("verdana",22),
    textvariable=val9,
    command=lambda:button_clicked(9),
)
btn9.pack(expan=True,side=LEFT,fill="both")

btnclear=Button(
    btnrow5,
    text="Clear",
    font=("verdana",22),
    command=lambda:clear(),
    bg="grey"
)
btnclear.pack(expand=True,side=LEFT,fill="both")

btnquit=Button(
    btnrow5,
    text="Quit",
    font=("verdana",22),
    command=root.destroy,
    bg="grey"
)
btnquit.pack(expand=True,side=LEFT,fill="both")
root.mainloop()


